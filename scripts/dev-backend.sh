#!/usr/bin/env bash
# Локальный запуск Go-сервисов (dev) против докерных Postgres/Kratos.
# Postgres/Kratos поднимаются отдельно: make up (только postgres kratos) или compose.
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="postgres://furnica:furnica_dev_change_me@localhost:5432/furnica?sslmode=disable"
export KRATOS_PUBLIC_URL="http://localhost:4433"
export KRATOS_ADMIN_URL="http://localhost:4434"
export CATALOG_GRPC_PORT=9091 PRICING_GRPC_PORT=9092 IMPORT_GRPC_PORT=9093
export CATALOG_GRPC_ADDR=localhost:9091 PRICING_GRPC_ADDR=localhost:9092 IMPORT_GRPC_ADDR=localhost:9093
export GATEWAY_PORT=8080 WEB_ORIGINS="http://localhost:3000"

mkdir -p bin
echo "building..."
go build -o bin/catalog ./services/catalog
go build -o bin/pricing ./services/pricing
go build -o bin/import ./services/import
go build -o bin/gateway ./services/gateway

pids=()
cleanup() { echo "stopping..."; kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "starting services..."
./bin/catalog & pids+=($!)
./bin/pricing & pids+=($!)
./bin/import  & pids+=($!)
sleep 1
./bin/gateway & pids+=($!)

wait
