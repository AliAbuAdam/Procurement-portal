# Furnica

Аналитическая платформа для закупок мебельной фурнитуры.
Первая итерация: сбор цен (импорт таблиц + API поставщиков), сопоставление
номенклатуры и сравнение цен во едином представлении.

## Архитектура

- **Backend** — Go, микросервисы. Внутри общаются по **gRPC**, наружу — только
  через `gateway` по **REST**.
- **БД** — PostgreSQL (одна, разные схемы на сервис).
- **Аутентификация** — Ory Kratos (self-hosted). Роли (`admin`/`manager`)
  хранятся в `metadata_public.role`, проверка прав — в `gateway`.
- **Frontend** — Next.js + shadcn/ui. Своя страница входа через `@ory/client`.
- **Деплой** — Docker-образы → Docker Hub → `docker compose pull` на Selectel VDS.
- **CI/CD** — GitHub Actions.

```
Browser ─HTTPS─> Next.js ─REST─> gateway ─gRPC─> catalog / pricing / import
                                    │                     │
                                  Kratos            PostgreSQL
```

## Структура репозитория (монорепо)

```
.
├── proto/            gRPC-контракты (.proto) + buf
├── gen/              сгенерированный из proto Go-код (buf generate)
├── services/         Go-микросервисы
│   ├── gateway/      REST -> gRPC, проверка сессии Kratos, RBAC
│   ├── catalog/      поставщики, карточки товаров, сопоставление
│   ├── pricing/      цены, наличие, история, сравнение
│   └── import/       загрузка Excel/CSV, коннекторы к API поставщиков
├── internal/         общий код сервисов (config, db, logging)
├── web/              Next.js + shadcn/ui
├── deploy/           docker-compose, конфиг Kratos, миграции
└── .github/workflows CI/CD
```

## Локальный запуск

```bash
cp .env.example .env
make proto          # генерация Go из .proto (нужен buf)
make up             # docker compose: postgres + kratos + сервисы + web
```

- Web: http://localhost:3000
- Gateway (REST): http://localhost:8080
- Kratos public: http://localhost:4433

## Фазы

- **Фаза 0 (текущая)** — каркас: репо, контракты, docker-compose, CI/CD.
- Фаза 1 — auth (Kratos) + импорт таблиц.
- Фаза 2 — сопоставление номенклатуры.
- Фаза 3 — сравнение цен.
