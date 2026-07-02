package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/jackc/pgx/v5"
)

type ProductRepository struct {
	db *postgres.TxManager
}

func NewProductRepository(db *postgres.TxManager) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) Create(ctx context.Context, p *domain.Product) error {
	const q = `
		INSERT INTO catalog.products (name, article)
		VALUES ($1, $2)
		RETURNING id, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, p.Name, p.Article).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert product: %w", err)
	}
	return nil
}

func (r *ProductRepository) List(ctx context.Context, limit int) ([]*domain.Product, error) {
	const q = `
		SELECT id, name, article, created_at
		FROM catalog.products
		ORDER BY created_at DESC, id
		LIMIT $1`
	rows, err := r.db.Querier(ctx).Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("query products: %w", err)
	}
	defer rows.Close()
	return scanProducts(rows)
}

// Search — триграммный поиск: карточки, чьё имя похоже на query, от самых похожих.
func (r *ProductRepository) Search(ctx context.Context, query string, limit int) ([]*domain.Product, error) {
	const q = `
		SELECT id, name, article, created_at
		FROM catalog.products
		WHERE name % $1
		ORDER BY similarity(name, $1) DESC, created_at DESC
		LIMIT $2`
	rows, err := r.db.Querier(ctx).Query(ctx, q, query, limit)
	if err != nil {
		return nil, fmt.Errorf("search products: %w", err)
	}
	defer rows.Close()
	return scanProducts(rows)
}

func (r *ProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	const q = `
		SELECT id, name, article, created_at
		FROM catalog.products
		WHERE id = $1`
	var p domain.Product
	err := r.db.Querier(ctx).QueryRow(ctx, q, id).
		Scan(&p.ID, &p.Name, &p.Article, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrProductNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get product: %w", err)
	}
	return &p, nil
}

func scanProducts(rows pgx.Rows) ([]*domain.Product, error) {
	var out []*domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Article, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		out = append(out, &p)
	}
	return out, rows.Err()
}
