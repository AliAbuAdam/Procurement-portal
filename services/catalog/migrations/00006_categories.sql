-- +goose Up
-- Категории витрины: дерево произвольной глубины (parent_id), товар может
-- лежать максимум в одной категории. Удаление категории уносит подкатегории
-- каскадом, товары остаются без категории (SET NULL) — карточки не теряем.
CREATE TABLE catalog.categories (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id  uuid REFERENCES catalog.categories(id) ON DELETE CASCADE,
    name       text        NOT NULL,
    position   int         NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX categories_parent_idx ON catalog.categories (parent_id);

ALTER TABLE catalog.products
    ADD COLUMN category_id uuid REFERENCES catalog.categories(id) ON DELETE SET NULL;

CREATE INDEX products_category_idx ON catalog.products (category_id)
    WHERE category_id IS NOT NULL;

-- +goose Down
ALTER TABLE catalog.products DROP COLUMN category_id;
DROP TABLE catalog.categories;
