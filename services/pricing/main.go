// Pricing service — цены, наличие, история и сравнение по товарной карточке.
package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"
	"time"

	pricingv1 "github.com/furnica/backend/gen/pricing/v1"
	"github.com/furnica/backend/internal/env"
	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/pricing/internal/api"
	"github.com/furnica/backend/services/pricing/internal/repository"
	"github.com/furnica/backend/services/pricing/internal/service"
	"github.com/furnica/backend/services/pricing/migrations"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

const schema = "pricing"

func main() {
	if err := run(); err != nil {
		log.Fatalf("pricing: %v", err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	dsn := env.Get("DATABASE_URL", "")
	addr := ":" + env.Get("PRICING_GRPC_PORT", "9092")

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
	priceRepo := repository.NewPriceRepository(txm)
	priceSvc := service.NewPriceService(priceRepo)
	srv := api.NewPricingServer(priceSvc)

	grpcServer := grpc.NewServer()
	pricingv1.RegisterPricingServiceServer(grpcServer, srv)

	healthSrv := health.NewServer()
	healthSrv.SetServingStatus("pricing", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(grpcServer, healthSrv)
	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		log.Printf("pricing: shutting down")
		grpcServer.GracefulStop()
	}()

	log.Printf("pricing: gRPC listening on %s", addr)
	return grpcServer.Serve(lis)
}
