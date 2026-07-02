-- +goose Up
CREATE TABLE pricing.price_records (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    uuid        NOT NULL,
    supplier_id   uuid        NOT NULL,
    supplier_name text        NOT NULL,
    price         numeric(14,2) NOT NULL,
    currency      text        NOT NULL DEFAULT 'RUB',
    in_stock      boolean     NOT NULL DEFAULT false,
    stock_qty     bigint      NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Быстрый доступ к последним ценам по товару (для сравнения).
CREATE INDEX price_records_product_supplier_idx
    ON pricing.price_records (product_id, supplier_id, updated_at DESC);

-- +goose Down
DROP TABLE pricing.price_records;
