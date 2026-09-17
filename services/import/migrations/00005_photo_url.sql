-- +goose Up
-- Ссылка (URL) на фото товара из прайса поставщика. Сами байты не храним:
-- catalog скачивает фото по ссылке при создании/привязке карточки.
ALTER TABLE importer.supplier_offers
    ADD COLUMN photo_url text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE importer.supplier_offers DROP COLUMN photo_url;
