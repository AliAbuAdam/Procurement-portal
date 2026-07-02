-- +goose Up
-- Схема создаётся раннером до запуска goose; здесь — только объекты.
CREATE TABLE catalog.suppliers (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    type       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX suppliers_name_lower_uidx ON catalog.suppliers (lower(name));

-- +goose Down
DROP TABLE catalog.suppliers;
