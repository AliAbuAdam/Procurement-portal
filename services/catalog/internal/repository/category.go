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

type CategoryRepository struct {
	db *postgres.TxManager
}

func NewCategoryRepository(db *postgres.TxManager) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) List(ctx context.Context) ([]*domain.Category, error) {
	const q = `
		SELECT c.id, COALESCE(c.parent_id::text, ''), c.name, c.position, c.created_at,
		       (SELECT count(*) FROM catalog.products p WHERE p.category_id = c.id)
		FROM catalog.categories c
		ORDER BY c.position, c.name, c.id`
	rows, err := r.db.Querier(ctx).Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	var out []*domain.Category
	for rows.Next() {
		var c domain.Category
		if err := rows.Scan(&c.ID, &c.ParentID, &c.Name, &c.Position, &c.CreatedAt, &c.ProductCount); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		out = append(out, &c)
	}
	return out, rows.Err()
}

func (r *CategoryRepository) UncategorizedCount(ctx context.Context) (int, error) {
	var n int
	err := r.db.Querier(ctx).
		QueryRow(ctx, `SELECT count(*) FROM catalog.products WHERE category_id IS NULL`).
		Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count uncategorized: %w", err)
	}
	return n, nil
}

func (r *CategoryRepository) Create(ctx context.Context, c *domain.Category) error {
	// Новая категория встаёт в конец списка сиблингов.
	const q = `
		INSERT INTO catalog.categories (parent_id, name, position)
		VALUES (
			NULLIF($1, '')::uuid, $2,
			COALESCE((SELECT max(position) + 1 FROM catalog.categories
			          WHERE parent_id IS NOT DISTINCT FROM NULLIF($1, '')::uuid), 0)
		)
		RETURNING id, position, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, c.ParentID, c.Name).
		Scan(&c.ID, &c.Position, &c.CreatedAt)
	if err != nil {
		return categoryWriteErr("insert category", err)
	}
	return nil
}

func (r *CategoryRepository) Update(ctx context.Context, c *domain.Category) error {
	// Перенос узла в собственное поддерево создал бы цикл — проверяем заранее.
	if c.ParentID != "" {
		const cycleQ = `
			WITH RECURSIVE sub AS (
				SELECT id FROM catalog.categories WHERE id = $1
				UNION ALL
				SELECT ch.id FROM catalog.categories ch JOIN sub ON ch.parent_id = sub.id
			)
			SELECT EXISTS (SELECT 1 FROM sub WHERE id = $2::uuid)`
		var cycle bool
		if err := r.db.Querier(ctx).QueryRow(ctx, cycleQ, c.ID, c.ParentID).Scan(&cycle); err != nil {
			return categoryWriteErr("check category cycle", err)
		}
		if cycle {
			return domain.ErrCategoryCycle
		}
	}

	const q = `
		UPDATE catalog.categories
		SET parent_id = NULLIF($2, '')::uuid, name = $3
		WHERE id = $1
		RETURNING position, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, c.ID, c.ParentID, c.Name).
		Scan(&c.Position, &c.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrCategoryNotFound
	}
	if err != nil {
		return categoryWriteErr("update category", err)
	}
	return nil
}

func (r *CategoryRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Querier(ctx).Exec(ctx, `DELETE FROM catalog.categories WHERE id = $1`, id)
	if err != nil {
		return categoryWriteErr("delete category", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrCategoryNotFound
	}
	return nil
}

// categoryWriteErr мапит ошибки Postgres в доменные: несуществующий родитель
// (нарушение FK) и кривой uuid из URL/тела — вина клиента, не 500.
func categoryWriteErr(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503": // foreign_key_violation: parent_id не существует
			return domain.ErrCategoryNotFound
		case "22P02": // invalid_text_representation: не uuid
			return fmt.Errorf("%w: некорректный id категории", domain.ErrValidation)
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}
