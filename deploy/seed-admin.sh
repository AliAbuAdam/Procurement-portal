#!/usr/bin/env bash
# Заводит ПЕРВОГО администратора через Kratos Admin API (внутренний порт 4434,
# наружу он не открыт). Запускать на VDS ПОСЛЕ старта прод-стека.
#
# Использование:
#   deploy/seed-admin.sh admin@furnica.ru 'СильныйПароль123!'
#
# Дальше остальных пользователей заводит этот админ из UI («Пользователи»).
set -euo pipefail

EMAIL="${1:?использование: seed-admin.sh <email> <password>}"
PASSWORD="${2:?использование: seed-admin.sh <email> <password>}"

# Сеть compose: проект называется furnica -> сеть furnica_default.
NETWORK="$(docker network ls --format '{{.Name}}' | grep -E '^furnica_default$' | head -1)"
NETWORK="${NETWORK:-furnica_default}"

PAYLOAD=$(cat <<JSON
{
  "schema_id": "user",
  "traits": { "email": "${EMAIL}" },
  "metadata_public": { "role": "admin" },
  "credentials": { "password": { "config": { "password": "${PASSWORD}" } } }
}
JSON
)

echo "Создаю администратора ${EMAIL} (сеть ${NETWORK})…"
docker run --rm --network "${NETWORK}" curlimages/curl:latest \
  -sS -X POST http://kratos:4434/admin/identities \
  -H 'Content-Type: application/json' \
  -d "${PAYLOAD}"
echo
echo "Готово, если выше вернулся JSON identity без поля error."
