# Деплой на Selectel VDS с доменом и HTTPS

Прод-стек тянет готовые образы из Docker Hub и запускается за обратным прокси
**Caddy** (авто-TLS Let's Encrypt). Наружу открыты только 80/443 — Postgres,
Kratos и Go-сервисы доступны лишь внутри сети Docker.

Схема одного домена (всё same-origin → куки Kratos и API без CORS):

```
https://DOMAIN/                     -> web (Next.js)
https://DOMAIN/api/*                -> gateway (REST)
https://DOMAIN/.ory/kratos/public/* -> kratos (public API)
```

Файлы: `deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `.env.prod.example`,
`deploy/seed-admin.sh`.

---

## 0. Что нужно заранее

- VDS на Selectel (4 vCPU / 8 ГБ / 80 ГБ, Ubuntu 24.04) и его публичный IP.
- Домен (или поддомен), к DNS которого есть доступ.
- Аккаунт Docker Hub (образы тянутся оттуда).

---

## 1. Публикация образов (GitHub Actions → Docker Hub)

Образы собирает workflow `docker-publish.yml` — **по тегу `v*`**. Один раз задайте
в репозитории GitHub → Settings → Secrets and variables → Actions:

- Secret `DOCKERHUB_USERNAME` — логин Docker Hub.
- Secret `DOCKERHUB_TOKEN` — access token (Docker Hub → Account → Security).
- Variable `DOCKER_NAMESPACE` — namespace образов (обычно = логин Docker Hub).

Затем выпустите релиз-тег:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow соберёт и запушит `NAMESPACE/furnica-{gateway,catalog,pricing,import,web}:v0.1.0`
и `:latest`. Проверить: вкладка Actions → «Docker Publish» зелёный.

> Веб-образ доменно-независим (NEXT_PUBLIC_* — относительные пути), поэтому один
> образ подходит для любого домена.

---

## 2. DNS

A-запись домена → публичный IP VDS:

```
DOMAIN.  A  <IP_VDS>
```

Дождитесь распространения (`dig +short DOMAIN` должен вернуть IP). Let's Encrypt
не выдаст сертификат, пока домен не резолвится в этот сервер.

---

## 3. Подготовка VDS

```bash
# Docker + compose plugin (официальный скрипт)
curl -fsSL https://get.docker.com | sh

# Файрвол: наружу только SSH и HTTP/HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
# ВАЖНО: порты 5432 (Postgres) и 4434 (Kratos admin) наружу НЕ открывать.
```

Залогиньтесь в Docker Hub (если образы приватные):

```bash
docker login
```

---

## 4. Код и секреты на сервере

```bash
git clone https://github.com/AliAbuAdam/Procurement-portal.git furnica
cd furnica

cp .env.prod.example .env.prod
```

Отредактируйте `.env.prod`:

- `DOMAIN`, `ACME_EMAIL`;
- `DOCKER_NAMESPACE` (ваш namespace на Docker Hub), при желании `IMAGE_TAG=v0.1.0`;
- `POSTGRES_PASSWORD` — и тот же пароль в `DATABASE_URL` и `KRATOS_DSN`;
- секреты Kratos:

```bash
openssl rand -hex 32   # -> KRATOS_COOKIE_SECRET
openssl rand -hex 16   # -> KRATOS_CIPHER_SECRET (ровно 32 символа)
openssl rand -base64 24  # -> POSTGRES_PASSWORD (без спецсимволов для DSN)
```

`.env.prod` в `.gitignore` — в репозиторий не попадёт.

---

## 5. Запуск

```bash
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml pull
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml up -d
```

Что произойдёт: поднимется Postgres (создаст схемы из `deploy/postgres/init`),
применятся миграции Kratos, стартуют Go-сервисы (свои миграции — на старте),
gateway, web и Caddy. Caddy сам получит TLS-сертификат для `DOMAIN`.

Проверка:

```bash
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml ps
curl -sf https://DOMAIN/api/healthz     # {"status":"ok","service":"gateway"}
```

Логи при проблемах:

```bash
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml logs -f caddy kratos gateway
```

---

## 6. Первый администратор

Саморегистрация выключена — первого админа заводим напрямую через Kratos Admin API:

```bash
deploy/seed-admin.sh admin@DOMAIN 'СильныйПароль123!'
```

Дальше входите на `https://DOMAIN`, остальных пользователей заводит админ из
раздела «Пользователи».

---

## 7. Обновление версии

```bash
git tag v0.2.0 && git push origin v0.2.0     # CI соберёт образы
# на VDS:
# при фиксированном IMAGE_TAG — обновите его в .env.prod (v0.2.0)
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml pull
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml up -d
```

Миграции БД применяются автоматически при старте сервисов.

---

## 8. Бэкапы БД (рекомендуется)

Разово проверить дамп, затем повесить в cron:

```bash
docker compose --env-file .env.prod -f deploy/docker-compose.prod.yml \
  exec -T postgres pg_dump -U furnica furnica | gzip > furnica-$(date +%F).sql.gz
```

Данные Postgres лежат в docker-томе `furnica_pgdata` (переживает пересоздание
контейнеров). Тома НЕ удаляйте при обновлениях (`down` без `-v`).

---

## Траблшутинг

- **Нет сертификата / 522**: проверьте, что DNS указывает на этот IP и порты
  80/443 открыты в ufw и в облачном файрволе Selectel.
- **502 на /api или /**: сервис ещё поднимается или упал — смотрите его логи.
- **Логин не проходит / слетает сессия**: проверьте `DOMAIN` в `.env.prod`
  (должен совпадать с реальным) и что заходите по `https://` (не по IP).
- **`cipher: invalid length`**: `KRATOS_CIPHER_SECRET` должен быть ровно 32 символа.
