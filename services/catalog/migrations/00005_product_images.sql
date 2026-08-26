-- +goose Up
-- Галерея фото карточки (до 10 шт.). Байты храним в Postgres, наружу
-- отдаются через gateway GET /api/v1/images/{id}. thumb — миниатюра для списков.
CREATE TABLE catalog.product_images (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   uuid        NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    position     integer     NOT NULL DEFAULT 0,
    content_type text        NOT NULL DEFAULT 'image/jpeg',
    data         bytea       NOT NULL,
    thumb        bytea       NOT NULL DEFAULT ''::bytea,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_images_product_idx ON catalog.product_images (product_id, position, created_at);

-- Переносим уже загруженные фото (data-URL в products.image_url) в галерею.
-- Построчно и с перехватом ошибок: одна битая base64-строка не должна валить миграцию.
-- Внешние URL (http...) не трогаем — их продолжает показывать легаси-поле image_url.
-- +goose StatementBegin
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id,
               split_part(split_part(image_url, ':', 2), ';', 1) AS ctype,
               split_part(image_url, 'base64,', 2)               AS b64
        FROM catalog.products
        WHERE image_url LIKE 'data:image/%;base64,%'
    LOOP
        BEGIN
            INSERT INTO catalog.product_images (product_id, position, content_type, data)
            VALUES (r.id, 0, r.ctype, decode(r.b64, 'base64'));
            UPDATE catalog.products SET image_url = '' WHERE id = r.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'product % image skipped: %', r.id, SQLERRM;
        END;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
DROP TABLE catalog.product_images;
