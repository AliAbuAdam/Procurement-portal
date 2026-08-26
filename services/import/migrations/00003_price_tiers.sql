-- +goose Up
-- Уровни цен в строке прайса: базовая (price) + опт + крупный опт.
-- 0 = колонки в прайсе поставщика не было.
ALTER TABLE importer.supplier_offers
    ADD COLUMN price_opt  numeric(14,2) NOT NULL DEFAULT 0,
    ADD COLUMN price_bulk numeric(14,2) NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE importer.supplier_offers
    DROP COLUMN price_opt,
    DROP COLUMN price_bulk;
