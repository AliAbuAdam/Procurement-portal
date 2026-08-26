package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/jackc/pgx/v5"
)

type ProductImageRepository struct {
	db *postgres.TxManager
}

func NewProductImageRepository(db *postgres.TxManager) *ProductImageRepository {
	return &ProductImageRepository{db: db}
}

func (r *ProductImageRepository) ListByProduct(ctx context.Context, productID string) ([]*domain.ProductImage, error) {
	const q = `
		SELECT id, product_id, position, content_type, created_at
		FROM catalog.product_images
		WHERE product_id = $1
		ORDER BY position, created_at`
	rows, err := r.db.Querier(ctx).Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("query images: %w", err)
	}
	defer rows.Close()

	var out []*domain.ProductImage
	for rows.Next() {
		var img domain.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.Position, &img.ContentType, &img.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan image: %w", err)
		}
		out = append(out, &img)
	}
	return out, rows.Err()
}

func (r *ProductImageRepository) CountByProduct(ctx context.Context, productID string) (int, error) {
	var n int
	err := r.db.Querier(ctx).
		QueryRow(ctx, `SELECT count(*) FROM catalog.product_images WHERE product_id = $1`, productID).
		Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count images: %w", err)
	}
	return n, nil
}

// Insert добавляет фото в конец галереи (position = max+1).
func (r *ProductImageRepository) Insert(ctx context.Context, img *domain.ProductImage) error {
	const q = `
		INSERT INTO catalog.product_images (product_id, position, content_type, data, thumb)
		VALUES (
			$1,
			COALESCE((SELECT max(position) + 1 FROM catalog.product_images WHERE product_id = $1), 0),
			$2, $3, $4
		)
		RETURNING id, position, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, img.ProductID, img.ContentType, img.Data, img.Thumb).
		Scan(&img.ID, &img.Position, &img.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert image: %w", err)
	}
	return nil
}

func (r *ProductImageRepository) GetData(ctx context.Context, id string, thumb bool) (string, []byte, error) {
	// Миниатюры может не быть (пустая) — тогда отдаём оригинал.
	const q = `
		SELECT content_type,
		       CASE WHEN $2 AND length(thumb) > 0 THEN thumb ELSE data END
		FROM catalog.product_images
		WHERE id = $1`
	var contentType string
	var data []byte
	err := r.db.Querier(ctx).QueryRow(ctx, q, id, thumb).Scan(&contentType, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, domain.ErrImageNotFound
	}
	if err != nil {
		return "", nil, fmt.Errorf("get image: %w", err)
	}
	return contentType, data, nil
}

func (r *ProductImageRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Querier(ctx).Exec(ctx, `DELETE FROM catalog.product_images WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete image: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrImageNotFound
	}
	return nil
}

// Reorder выставляет position по порядку ids. Чужие id (не этой карточки)
// молча игнорируются условием product_id.
func (r *ProductImageRepository) Reorder(ctx context.Context, productID string, ids []string) error {
	const q = `
		UPDATE catalog.product_images AS pi
		SET position = ord.pos
		FROM unnest($2::uuid[]) WITH ORDINALITY AS ord(id, pos)
		WHERE pi.id = ord.id AND pi.product_id = $1`
	if _, err := r.db.Querier(ctx).Exec(ctx, q, productID, ids); err != nil {
		return fmt.Errorf("reorder images: %w", err)
	}
	return nil
}
