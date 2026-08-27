-- +goose Up
-- Категория товара в терминах поставщика (как написано в его прайсе).
-- Сырьё для привязки «категория поставщика -> категория витрины»
-- (catalog.category_mappings).
ALTER TABLE importer.supplier_offers
    ADD COLUMN raw_category text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE importer.supplier_offers DROP COLUMN raw_category;
