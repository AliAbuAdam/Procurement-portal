-- +goose Up
-- Схема catalog создаётся раннером до goose; здесь — только объекты.

-- pg_trgm нужен для нечёткого поиска кандидатов по названию (matching):
-- оператор `%`, similarity() и класс операторов gin_trgm_ops.
-- Расширение держим в public, чтобы триграммные функции были на search_path
-- всех сервисов. Kratos ставит pg_trgm в свою схему `kratos` — если так, то
-- переносим его в public (идемпотентно, объекты сохраняют OID).
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE EXTENSION pg_trgm SCHEMA public;
    ELSIF (SELECT extnamespace::regnamespace::text FROM pg_extension WHERE extname = 'pg_trgm') <> 'public' THEN
        ALTER EXTENSION pg_trgm SET SCHEMA public;
    END IF;
END $$;
-- +goose StatementEnd

-- Мастер-карточка номенклатуры: к ней сопоставляются сырые строки прайсов.
CREATE TABLE catalog.products (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    article    text        NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Триграммный индекс для similarity(name, ...) и оператора `%`.
CREATE INDEX products_name_trgm_idx ON catalog.products USING gin (name gin_trgm_ops);
-- Точечный поиск по артикулу (если задан).
CREATE INDEX products_article_idx ON catalog.products (lower(article)) WHERE article <> '';

-- Подтверждённое сопоставление offer -> product.
-- Строка существует ТОЛЬКО для подтверждённых связок; кандидаты не храним —
-- считаем на лету через pg_trgm. Несопоставленная строка = offer без записи здесь.
-- offer_id логически ссылается на importer.supplier_offers(id). FK между схемами
-- НЕ ставим намеренно: сервисы мигрируют независимо (catalog может стартовать
-- раньше import), а cross-schema FK связал бы порядок их миграций. Осиротевшие
-- match'и при удалении батча вычищаем на уровне приложения (в Фазе 2 батчи из UI
-- не удаляются).
CREATE TABLE catalog.offer_matches (
    offer_id   uuid PRIMARY KEY,
    product_id uuid        NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    score      real        NOT NULL DEFAULT 0,  -- similarity на момент подтверждения
    matched_by text        NOT NULL DEFAULT '',
    matched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX offer_matches_product_idx ON catalog.offer_matches (product_id);

-- +goose Down
DROP TABLE catalog.offer_matches;
DROP TABLE catalog.products;
-- pg_trgm намеренно не удаляем: может использоваться другими объектами.
