-- +goose Up
CREATE TABLE importer.import_batches (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id  uuid        NOT NULL,
    file_name    text        NOT NULL,
    status       text        NOT NULL DEFAULT 'pending',
    rows_total   integer     NOT NULL DEFAULT 0,
    rows_matched integer     NOT NULL DEFAULT 0,
    created_by   text        NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_batches_supplier_idx ON importer.import_batches (supplier_id, created_at DESC);

-- +goose Down
DROP TABLE importer.import_batches;
