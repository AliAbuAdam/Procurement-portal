-- +goose Up
-- Привязка «категория поставщика (текст из прайса) -> категория витрины».
-- Один текст одного поставщика ведёт максимум в одну свою категорию.
-- При удалении категории витрины привязки уходят каскадом; на поставщика FK
-- не ставим (та же политика, что и offer_matches: удаление чистится приложением).
CREATE TABLE catalog.category_mappings (
    supplier_id  uuid        NOT NULL,
    raw_category text        NOT NULL,
    category_id  uuid        NOT NULL REFERENCES catalog.categories(id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (supplier_id, raw_category)
);

CREATE INDEX category_mappings_category_idx ON catalog.category_mappings (category_id);

-- +goose Down
DROP TABLE catalog.category_mappings;
