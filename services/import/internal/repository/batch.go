// Package repository — доступ к данным import через pgx.
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/import/internal/domain"
	"github.com/jackc/pgx/v5"
)

type ImportRepository struct {
	db *postgres.TxManager
}

func NewImportRepository(db *postgres.TxManager) *ImportRepository {
	return &ImportRepository{db: db}
}

func (r *ImportRepository) Create(ctx context.Context, b *domain.ImportBatch) error {
	const q = `
		INSERT INTO importer.import_batches (supplier_id, file_name, status, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, rows_total, rows_matched, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, b.SupplierID, b.FileName, string(b.Status), b.CreatedBy).
		Scan(&b.ID, &b.RowsTotal, &b.RowsMatched, &b.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert import batch: %w", err)
	}
	return nil
}

func (r *ImportRepository) GetByID(ctx context.Context, id string) (*domain.ImportBatch, error) {
	const q = `
		SELECT id, supplier_id, file_name, status, rows_total, rows_matched, created_by, created_at
		FROM importer.import_batches
		WHERE id = $1`
	var b domain.ImportBatch
	var st string
	err := r.db.Querier(ctx).QueryRow(ctx, q, id).
		Scan(&b.ID, &b.SupplierID, &b.FileName, &st, &b.RowsTotal, &b.RowsMatched, &b.CreatedBy, &b.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get import batch: %w", err)
	}
	b.Status = domain.ImportStatus(st)
	return &b, nil
}

func (r *ImportRepository) ListBySupplier(ctx context.Context, supplierID string) ([]*domain.ImportBatch, error) {
	const q = `
		SELECT id, supplier_id, file_name, status, rows_total, rows_matched, created_by, created_at
		FROM importer.import_batches
		WHERE ($1 = '' OR supplier_id = $1::uuid)
		ORDER BY created_at DESC
		LIMIT 200`
	rows, err := r.db.Querier(ctx).Query(ctx, q, supplierID)
	if err != nil {
		return nil, fmt.Errorf("list batches: %w", err)
	}
	defer rows.Close()

	var out []*domain.ImportBatch
	for rows.Next() {
		var b domain.ImportBatch
		var st string
		if err := rows.Scan(&b.ID, &b.SupplierID, &b.FileName, &st, &b.RowsTotal, &b.RowsMatched, &b.CreatedBy, &b.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan batch: %w", err)
		}
		b.Status = domain.ImportStatus(st)
		out = append(out, &b)
	}
	return out, rows.Err()
}

func (r *ImportRepository) UpdateResult(ctx context.Context, id string, status domain.ImportStatus, rowsTotal int) error {
	const q = `UPDATE importer.import_batches SET status = $2, rows_total = $3 WHERE id = $1`
	_, err := r.db.Querier(ctx).Exec(ctx, q, id, string(status), rowsTotal)
	if err != nil {
		return fmt.Errorf("update batch: %w", err)
	}
	return nil
}
