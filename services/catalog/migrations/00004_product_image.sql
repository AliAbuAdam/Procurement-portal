-- +goose Up
-- Фото товарной карточки. Пока строка (URL или data-URL); загрузка в S3 — позже.
ALTER TABLE catalog.products ADD COLUMN image_url text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE catalog.products DROP COLUMN image_url;
