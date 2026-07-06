// Package repository — доступ к данным catalog через pgx.
// Запросы берут Querier из TxManager, поэтому автоматически участвуют
// в транзакции, если она открыта слоем service.
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type SupplierRepository struct {
	db *postgres.TxManager
}

func NewSupplierRepository(db *postgres.TxManager) *SupplierRepository {
	return &SupplierRepository{db: db}
}

func (r *SupplierRepository) Create(ctx context.Context, s *domain.Supplier) error {
	const q = `
		INSERT INTO catalog.suppliers (name, type, city, address, logo, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, s.Name, string(s.Type), s.City, s.Address, s.Logo, string(s.Status)).
		Scan(&s.ID, &s.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert supplier: %w", err)
	}
	return nil
}

func (r *SupplierRepository) Update(ctx context.Context, s *domain.Supplier) error {
	const q = `
		UPDATE catalog.suppliers
		SET name = $2, type = $3, city = $4, address = $5, logo = $6, status = $7
		WHERE id = $1
		RETURNING created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, s.ID, s.Name, string(s.Type), s.City, s.Address, s.Logo, string(s.Status)).
		Scan(&s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation по имени
		return fmt.Errorf("%w: %s", domain.ErrSupplierExists, s.Name)
	}
	if err != nil {
		return fmt.Errorf("update supplier: %w", err)
	}
	return nil
}

func (r *SupplierRepository) Delete(ctx context.Context, id string) error {
	const q = `DELETE FROM catalog.suppliers WHERE id = $1`
	tag, err := r.db.Querier(ctx).Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("delete supplier: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *SupplierRepository) List(ctx context.Context, limit, offset int) ([]*domain.Supplier, error) {
	const q = `
		SELECT id, name, type, created_at, city, address, logo, status
		FROM catalog.suppliers
		ORDER BY created_at DESC, id
		LIMIT $1 OFFSET $2`
	rows, err := r.db.Querier(ctx).Query(ctx, q, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query suppliers: %w", err)
	}
	defer rows.Close()

	var out []*domain.Supplier
	for rows.Next() {
		var s domain.Supplier
		var t, status string
		if err := rows.Scan(&s.ID, &s.Name, &t, &s.CreatedAt, &s.City, &s.Address, &s.Logo, &status); err != nil {
			return nil, fmt.Errorf("scan supplier: %w", err)
		}
		s.Type = domain.SupplierType(t)
		s.Status = domain.SupplierStatus(status)
		out = append(out, &s)
	}
	return out, rows.Err()
}

func (r *SupplierRepository) ExistsByName(ctx context.Context, name string) (bool, error) {
	const q = `SELECT 1 FROM catalog.suppliers WHERE lower(name) = lower($1) LIMIT 1`
	var one int
	err := r.db.Querier(ctx).QueryRow(ctx, q, name).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("exists supplier: %w", err)
	}
	return true, nil
}
