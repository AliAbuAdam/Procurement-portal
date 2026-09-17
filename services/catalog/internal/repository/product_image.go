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

// S3KeysByProduct — непустые S3-ключи всех фото карточки (оригиналы и
// миниатюры) для очистки хранилища при удалении карточки.
func (r *ProductImageRepository) S3KeysByProduct(ctx context.Context, productID string) ([]string, error) {
	const q = `
		SELECT s3_key, s3_thumb_key
		FROM catalog.product_images
		WHERE product_id = $1`
	rows, err := r.db.Querier(ctx).Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("query image s3 keys: %w", err)
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var key, thumbKey string
		if err := rows.Scan(&key, &thumbKey); err != nil {
			return nil, fmt.Errorf("scan image s3 keys: %w", err)
		}
		if key != "" {
			keys = append(keys, key)
		}
		if thumbKey != "" {
			keys = append(keys, thumbKey)
		}
	}
	return keys, rows.Err()
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

func (r *ProductImageRepository) GetData(ctx context.Context, id string, thumb bool) (string, []byte, string, error) {
	// Миниатюры может не быть — тогда отдаём оригинал. Фото либо в Postgres
	// (байты), либо в S3 (ключ) — непустым будет ровно одно из двух.
	const q = `
		SELECT content_type,
		       CASE WHEN $2 AND thumb IS NOT NULL AND length(thumb) > 0 THEN thumb ELSE data END,
		       CASE WHEN $2 AND s3_thumb_key <> '' THEN s3_thumb_key ELSE s3_key END
		FROM catalog.product_images
		WHERE id = $1`
	var contentType, s3Key string
	var data []byte
	err := r.db.Querier(ctx).QueryRow(ctx, q, id, thumb).Scan(&contentType, &data, &s3Key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, "", domain.ErrImageNotFound
	}
	if err != nil {
		return "", nil, "", fmt.Errorf("get image: %w", err)
	}
	return contentType, data, s3Key, nil
}

func (r *ProductImageRepository) SetS3Keys(ctx context.Context, id, key, thumbKey string) error {
	const q = `
		UPDATE catalog.product_images
		SET s3_key = $2, s3_thumb_key = $3, data = NULL, thumb = NULL
		WHERE id = $1`
	tag, err := r.db.Querier(ctx).Exec(ctx, q, id, key, thumbKey)
	if err != nil {
		return fmt.Errorf("set image s3 keys: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrImageNotFound
	}
	return nil
}

func (r *ProductImageRepository) Delete(ctx context.Context, id string) (string, string, error) {
	const q = `DELETE FROM catalog.product_images WHERE id = $1 RETURNING s3_key, s3_thumb_key`
	var key, thumbKey string
	err := r.db.Querier(ctx).QueryRow(ctx, q, id).Scan(&key, &thumbKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", domain.ErrImageNotFound
	}
	if err != nil {
		return "", "", fmt.Errorf("delete image: %w", err)
	}
	return key, thumbKey, nil
}

// ListUnmigrated — фото, чьи байты ещё в Postgres (кандидаты на перенос в S3).
func (r *ProductImageRepository) ListUnmigrated(ctx context.Context, limit int) ([]*domain.ProductImage, error) {
	const q = `
		SELECT id, product_id, content_type, data, COALESCE(thumb, ''::bytea)
		FROM catalog.product_images
		WHERE s3_key = '' AND data IS NOT NULL
		ORDER BY created_at
		LIMIT $1`
	rows, err := r.db.Querier(ctx).Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("query unmigrated images: %w", err)
	}
	defer rows.Close()

	var out []*domain.ProductImage
	for rows.Next() {
		var img domain.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.ContentType, &img.Data, &img.Thumb); err != nil {
			return nil, fmt.Errorf("scan unmigrated image: %w", err)
		}
		out = append(out, &img)
	}
	return out, rows.Err()
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
