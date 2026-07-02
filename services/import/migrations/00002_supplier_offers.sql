-- +goose Up
CREATE TABLE importer.supplier_offers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id    uuid        NOT NULL REFERENCES importer.import_batches(id) ON DELETE CASCADE,
    supplier_id uuid        NOT NULL,
    row_num     integer     NOT NULL,
    raw_name    text        NOT NULL DEFAULT '',
    raw_article text        NOT NULL DEFAULT '',
    price       numeric(14,2) NOT NULL DEFAULT 0,
    currency    text        NOT NULL DEFAULT 'RUB',
    in_stock    boolean     NOT NULL DEFAULT false,
    stock_qty   bigint      NOT NULL DEFAULT 0
);

CREATE INDEX supplier_offers_batch_idx ON importer.supplier_offers (batch_id, row_num);
CREATE INDEX supplier_offers_supplier_idx ON importer.supplier_offers (supplier_id);

-- +goose Down
DROP TABLE importer.supplier_offers;
