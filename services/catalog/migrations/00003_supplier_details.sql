-- +goose Up
-- Дополнительные поля карточки поставщика: город, адрес, логотип, статус работы.
ALTER TABLE catalog.suppliers
    ADD COLUMN city    text NOT NULL DEFAULT '',
    ADD COLUMN address text NOT NULL DEFAULT '',
    ADD COLUMN logo    text NOT NULL DEFAULT '',   -- URL или data-URL картинки
    ADD COLUMN status  text NOT NULL DEFAULT 'new'; -- new | active | inactive

-- +goose Down
ALTER TABLE catalog.suppliers
    DROP COLUMN city,
    DROP COLUMN address,
    DROP COLUMN logo,
    DROP COLUMN status;
