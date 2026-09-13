// Catalog service — поставщики и товарные карточки (номенклатура).
// Композиционный корень: config → pool → миграции → repo → service → api → gRPC.
package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"
	"time"

	catalogv1 "github.com/furnica/backend/gen/catalog/v1"
	"github.com/furnica/backend/internal/env"
	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/api"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/furnica/backend/services/catalog/internal/repository"
	"github.com/furnica/backend/services/catalog/internal/service"
	"github.com/furnica/backend/services/catalog/internal/storage"
	"github.com/furnica/backend/services/catalog/migrations"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

const schema = "catalog"

func main() {
	if err := run(); err != nil {
		log.Fatalf("catalog: %v", err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dsn := env.Get("DATABASE_URL", "")
	addr := ":" + env.Get("CATALOG_GRPC_PORT", "9091")

	// Миграции применяются до старта (goose, встроенные .sql).
	migCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := postgres.Migrate(migCtx, dsn, schema, migrations.FS, "."); err != nil {
		return err
	}

	pool, err := postgres.NewPool(ctx, dsn)
	if err != nil {
		return err
	}
	defer pool.Close()

	// Сборка слоёв: repository -> service -> api.
	txm := postgres.NewTxManager(pool)
	supplierRepo := repository.NewSupplierRepository(txm)
	supplierSvc := service.NewSupplierService(txm, supplierRepo)

	// S3 для байтов фото; nil (S3_ENDPOINT пуст) — байты остаются в Postgres.
	s3, err := storage.NewS3FromEnv(ctx)
	if err != nil {
		return err
	}
	// Интерфейс через typed-nil указатель был бы != nil — поэтому явно.
	var store domain.ImageStore
	if s3 != nil {
		store = s3
		log.Printf("catalog: фото — в S3")
	} else {
		log.Printf("catalog: S3 не настроен, фото — в Postgres")
	}

	productRepo := repository.NewProductRepository(txm)
	matchRepo := repository.NewMatchRepository(txm)
	imageRepo := repository.NewProductImageRepository(txm)
	categoryRepo := repository.NewCategoryRepository(txm)
	matchingSvc := service.NewMatchingService(txm, productRepo, matchRepo, imageRepo, categoryRepo, store)

	categorySvc := service.NewCategoryService(txm, categoryRepo)

	adminRepo := repository.NewAdminRepository(txm)
	adminSvc := service.NewAdminService(txm, adminRepo, store)

	// Фоновая миграция старых фото из Postgres в S3 (идемпотентна, батчами).
	if store != nil {
		go func() {
			n, err := matchingSvc.MigrateImagesToS3(ctx)
			if err != nil {
				log.Printf("catalog: миграция фото в S3 прервана (перенесено %d): %v", n, err)
				return
			}
			if n > 0 {
				log.Printf("catalog: перенесено фото в S3: %d", n)
			}
		}()
	}

	srv := api.NewCatalogServer(supplierSvc, matchingSvc, categorySvc, adminSvc)

	grpcServer := grpc.NewServer()
	catalogv1.RegisterCatalogServiceServer(grpcServer, srv)

	healthSrv := health.NewServer()
	healthSrv.SetServingStatus("catalog", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		log.Printf("catalog: shutting down")
		grpcServer.GracefulStop()
	}()

	log.Printf("catalog: gRPC listening on %s", addr)
	return grpcServer.Serve(lis)
}
