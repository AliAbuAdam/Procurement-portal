# Фаза 2 — Сопоставление номенклатуры (реализовано)

Строки прайсов (`importer.supplier_offers`) привязываются к единым карточкам
товаров (`catalog.products`). Кандидаты подбираются автоматически по похожести
названия (**pg_trgm**), подтверждает человек. Подтверждённые связки сразу питают
сравнение цен (Фаза 3) — без отдельной синхронизации.

## Модель данных (схема `catalog`, миграция `00002`)

- `catalog.products` — мастер-карточка: `id, name, article, created_at, updated_at`.
  GIN-индекс `gin_trgm_ops` по `name` для `similarity()` и оператора `%`.
- `catalog.offer_matches` — подтверждённая связка `offer_id → product_id`
  (+`score, matched_by, matched_at`). Строка существует **только** для
  подтверждённых связок; «несопоставленная» = offer без строки здесь. Кандидаты
  не материализуем — считаем на лету.
- `pg_trgm` переносится в схему `public` (Kratos ставит его в `kratos`; подробнее
  в блоке «Ограничения»).

## gRPC (catalog) и REST (gateway)

| REST (`/api/v1`)                     | gRPC (CatalogService)      | Назначение |
|--------------------------------------|----------------------------|------------|
| `GET  /products?q=`                  | `ListProducts`             | список / триграммный поиск |
| `POST /products`                     | `CreateProduct`            | создать карточку вручную |
| `GET  /imports/{id}/unmatched`       | `ListUnmatchedOffers`      | несопоставленные строки батча + прогресс |
| `POST /matches/suggest`              | `SuggestMatches`           | топ-N кандидатов на строки |
| `POST /matches`                      | `ConfirmMatch`             | подтвердить связку |
| `POST /matches/from-offer`           | `CreateProductFromOffer`   | создать карточку из строки и подтвердить |
| `DELETE /matches/{offerID}`          | `Unmatch`                  | снять связку |

Доступ — и `admin`, и `manager` (отдельного `RequireRole` нет; это рабочий процесс).
`matched_by` проставляет gateway из сессии Kratos.

## Цены для сравнения — живой джойн

`pricing.CompareByProduct` считает цены **на лету**: джойнит
`catalog.offer_matches × importer.supplier_offers × catalog.suppliers` и берёт по
каждому поставщику строку из самого свежего импорта. Таблица `pricing.price_records`
**не используется**. Плюс: подтверждение связки сразу отражается в сравнении, нет
рассинхрона. Минус: pricing читает две чужие схемы — принято сознательно (одна БД).

## Web (Next.js)

- `/products` — «Номенклатура»: список, триграммный поиск, создание карточки.
- `/matching` — «Сопоставление»: выбор загрузки → построчный подбор кандидатов
  (с %-похожести), прогресс-бар, ручной поиск карточки, «создать карточку из строки».

## Ключевые решения

- **Живой джойн** вместо материализации цен (по требованию клиента — всегда свежая цена).
- Карточки создают и сопоставляют **и admin, и manager**.
- Товар пока = `name + article` (категории/ед.изм. — позже).
- `score` = `similarity()` считается в БД при подтверждении.
- **Cross-schema read:** catalog читает `importer.supplier_offers`, pricing —
  `catalog.*` и `importer.*`. Запись в чужие схемы по-прежнему запрещена.

## Известные ограничения и заметки

- **Cross-schema FK намеренно нет.** `offer_matches.offer_id` ссылается на
  `importer.supplier_offers(id)` только логически: FK связал бы порядок миграций
  независимых сервисов (catalog может стартовать раньше import). Все запросы к
  match'ам джойнятся с `supplier_offers`, поэтому осиротевшая связка (если строка
  исчезла) нигде не всплывает — она инертна. **Сейчас батчи из UI/API не удаляются,
  значит осиротевшие match'и не возникают.** Когда появится удаление батча — в тот
  же обработчик добавить `DELETE FROM catalog.offer_matches WHERE offer_id = ANY(...)`.
- **`importer.import_batches.rows_matched`** сейчас не поддерживается (всегда 0):
  прогресс считаем на лету в `ListUnmatchedOffers` (`total`/`matched`). Колонку
  можно позже удалить отдельной миграцией import.
- **pg_trgm в схеме `kratos`.** Kratos ставит расширение в свою схему, поэтому
  миграция catalog `00002` идемпотентно переносит его в `public`
  (`ALTER EXTENSION pg_trgm SET SCHEMA public`; OID сохраняется, Kratos не ломается).
