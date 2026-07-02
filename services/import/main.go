// Import service — загрузка прайсов (Excel/CSV) и коннекторы к API поставщиков.
package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"
	"time"

	importv1 "github.com/furnica/backend/gen/import/v1"
	"github.com/furnica/backend/internal/env"
	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/import/internal/api"
	"github.com/furnica/backend/services/import/internal/repository"
	"github.com/furnica/backend/services/import/internal/service"
	"github.com/furnica/backend/services/import/migrations"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

const schema = "importer"

func main() {
	if err := run(); err != nil {
		log.Fatalf("import: %v", err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dsn := env.Get("DATABASE_URL", "")
	addr := ":" + env.Get("IMPORT_GRPC_PORT", "9093")

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

	txm := postgres.NewTxManager(pool)
	importRepo := repository.NewImportRepository(txm)
	offerRepo := repository.NewOfferRepository(txm)
	importSvc := service.NewImportService(txm, importRepo, offerRepo)
	srv := api.NewImportServer(importSvc)

	grpcServer := grpc.NewServer()
	importv1.RegisterImportServiceServer(grpcServer, srv)

	healthSrv := health.NewServer()
	healthSrv.SetServingStatus("import", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		log.Printf("import: shutting down")
		grpcServer.GracefulStop()
	}()

	log.Printf("import: gRPC listening on %s", addr)
	return grpcServer.Serve(lis)
}
