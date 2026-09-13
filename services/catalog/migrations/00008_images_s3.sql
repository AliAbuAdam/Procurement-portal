-- +goose Up
-- Фото переезжают в S3 (Selectel): в строке остаётся только ключ объекта,
-- байты обнуляются. Строки с data IS NOT NULL и пустым s3_key — ещё не
-- перенесённые, их подбирает фоновый мигратор на старте сервиса.
-- Без настроенного S3 сервис продолжает писать байты в Postgres (dev-режим).
ALTER TABLE catalog.product_images
    ALTER COLUMN data DROP NOT NULL,
    ALTER COLUMN thumb DROP NOT NULL,
    ADD COLUMN s3_key       text NOT NULL DEFAULT '',
    ADD COLUMN s3_thumb_key text NOT NULL DEFAULT '';

-- +goose Down
-- ВНИМАНИЕ: откат не возвращает байты из S3.
ALTER TABLE catalog.product_images
    DROP COLUMN s3_key,
    DROP COLUMN s3_thumb_key;
