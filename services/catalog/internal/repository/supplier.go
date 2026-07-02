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
)

type SupplierRepository struct {
	db *postgres.TxManager
}

func NewSupplierRepository(db *postgres.TxManager) *SupplierRepository {
	return &SupplierRepository{db: db}
}

func (r *SupplierRepository) Create(ctx context.Context, s *domain.Supplier) error {
	const q = `
		INSERT INTO catalog.suppliers (name, type)
		VALUES ($1, $2)
		RETURNING id, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, s.Name, string(s.Type)).
		Scan(&s.ID, &s.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert supplier: %w", err)
	}
	return nil
}

func (r *SupplierRepository) List(ctx context.Context, limit, offset int) ([]*domain.Supplier, error) {
	const q = `
		SELECT id, name, type, created_at
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
		var t string
		if err := rows.Scan(&s.ID, &s.Name, &t, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan supplier: %w", err)
		}
		s.Type = domain.SupplierType(t)
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
