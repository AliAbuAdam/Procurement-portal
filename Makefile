SHELL := /bin/bash

# Сервисы (совпадают с каталогами в services/ и целями сборки в Dockerfile).
SERVICES      := gateway catalog pricing import
COMPOSE       := docker compose -f deploy/docker-compose.yml --env-file .env
DOCKER_NS     ?= furnica
IMAGE_TAG     ?= latest
GOOSE_DBSTRING?= postgres://furnica:furnica_dev_change_me@localhost:5432/furnica?sslmode=disable

.PHONY: help
help: ## Список целей
	@grep -E '^[a-zA-Z_%-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

## --- Кодогенерация ---

.PHONY: proto
proto: ## Сгенерировать Go из .proto (buf)
	cd proto && buf generate

.PHONY: proto-lint
proto-lint: ## Линт proto-контрактов
	cd proto && buf lint

## --- Go ---

.PHONY: tidy
tidy: ## go mod tidy
	go mod tidy

.PHONY: build
build: ## Собрать все сервисы локально в ./bin
	@mkdir -p bin
	@for s in $(SERVICES); do echo "build $$s"; go build -o bin/$$s ./services/$$s || exit 1; done

.PHONY: test
test: ## Прогнать тесты
	go test ./services/... ./internal/...

.PHONY: fmt
fmt: ## Форматирование
	gofmt -w services internal

## --- Миграции (goose) ---
## Пример: make migrate-create svc=catalog name=add_products
## schema сервиса создаётся раннером при старте; для CLI используем ту же таблицу версий.

.PHONY: migrate-create
migrate-create: ## Создать новую миграцию: svc=<сервис> name=<имя>
	goose -dir services/$(svc)/migrations create $(name) sql

.PHONY: migrate-status
migrate-status: ## Статус миграций: svc=<сервис>
	GOOSE_DRIVER=postgres GOOSE_DBSTRING="$(GOOSE_DBSTRING)" GOOSE_TABLE=$(svc_schema).goose_db_version \
		goose -dir services/$(svc)/migrations status

.PHONY: migrate-down
migrate-down: ## Откатить последнюю миграцию: svc=<сервис>
	GOOSE_DRIVER=postgres GOOSE_DBSTRING="$(GOOSE_DBSTRING)" GOOSE_TABLE=$(svc_schema).goose_db_version \
		goose -dir services/$(svc)/migrations down

# schema сервиса: importer у сервиса import, иначе совпадает с именем.
svc_schema = $(if $(filter import,$(svc)),importer,$(svc))

## --- Docker ---

.PHONY: docker-build
docker-build: ## Собрать образы всех сервисов
	@for s in $(SERVICES); do \
		echo "docker build $$s"; \
		docker build -f deploy/Dockerfile.service --build-arg SERVICE=$$s \
			-t $(DOCKER_NS)/furnica-$$s:$(IMAGE_TAG) . || exit 1; \
	done
	docker build -t $(DOCKER_NS)/furnica-web:$(IMAGE_TAG) web

.PHONY: docker-push
docker-push: ## Запушить образы в Docker Hub
	@for s in $(SERVICES) web; do docker push $(DOCKER_NS)/furnica-$$s:$(IMAGE_TAG); done

## --- Локальный запуск (docker compose) ---

.PHONY: up
up: ## Поднять весь стек (postgres + kratos + сервисы + web)
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Остановить стек
	$(COMPOSE) down

.PHONY: logs
logs: ## Логи стека
	$(COMPOSE) logs -f --tail=100

.PHONY: ps
ps: ## Статус контейнеров
	$(COMPOSE) ps
