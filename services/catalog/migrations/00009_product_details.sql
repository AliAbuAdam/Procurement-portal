-- +goose Up
-- Карточка товара: описание, характеристики и флаг «скрыт с витрины».
-- attrs — упорядоченный список пар {name, value} (jsonb-массив: объект бы
-- терял порядок, а порядок характеристик задаёт пользователь).
ALTER TABLE catalog.products
    ADD COLUMN description text    NOT NULL DEFAULT '',
    ADD COLUMN attrs       jsonb   NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN archived    boolean NOT NULL DEFAULT false;

-- Поиск по артикулу подстрокой (ILIKE) — тем же классом операторов, что имя.
CREATE INDEX products_article_trgm_idx ON catalog.products USING gin (article public.gin_trgm_ops);

-- +goose Down
DROP INDEX catalog.products_article_trgm_idx;
ALTER TABLE catalog.products
    DROP COLUMN description,
    DROP COLUMN attrs,
    DROP COLUMN archived;
