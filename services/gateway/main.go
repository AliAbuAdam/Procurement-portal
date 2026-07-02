// Gateway — единственная точка REST наружу. Проверяет сессию Kratos,
// применяет RBAC и проксирует запросы во внутренние сервисы по gRPC.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/furnica/backend/internal/env"
	"github.com/furnica/backend/services/gateway/internal/auth"
	"github.com/furnica/backend/services/gateway/internal/clients"
	"github.com/furnica/backend/services/gateway/internal/httpapi"
	"github.com/furnica/backend/services/gateway/internal/kratosadmin"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("gateway: %v", err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	c, err := clients.New(
		env.Get("CATALOG_GRPC_ADDR", "catalog:9091"),
		env.Get("PRICING_GRPC_ADDR", "pricing:9092"),
		env.Get("IMPORT_GRPC_ADDR", "import:9093"),
	)
	if err != nil {
		return err
	}
	defer c.Close()

	kratos := auth.NewKratos(env.Get("KRATOS_PUBLIC_URL", "http://kratos:4433"))
	admin := kratosadmin.New(env.Get("KRATOS_ADMIN_URL", "http://kratos:4434"))
	handler := httpapi.NewHandler(c, admin)
	allowedOrigins := strings.Split(env.Get("WEB_ORIGINS", "http://localhost:3000"), ",")
	router := httpapi.NewRouter(handler, kratos, allowedOrigins)

	srv := &http.Server{
		Addr:              ":" + env.Get("GATEWAY_PORT", "8080"),
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		log.Printf("gateway: shutting down")
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Printf("gateway: REST listening on %s", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}
