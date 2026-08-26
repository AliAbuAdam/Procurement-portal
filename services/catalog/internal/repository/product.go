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
		INSERT INTO catalog.products (name, article, image_url)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, p.Name, p.Article, p.ImageURL).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert product: %w", err)
	}
	return nil
}

// coverSelect / coverJoin — id первого фото галереи (обложка) для списков:
// LATERAL-подзапрос по индексу (product_id, position, created_at), байты не тянем.
const (
	coverSelect = `COALESCE(c.id::text, '') AS cover_image_id`
	coverJoin   = `
		LEFT JOIN LATERAL (
			SELECT id FROM catalog.product_images
			WHERE product_id = p.id
			ORDER BY position, created_at
			LIMIT 1
		) c ON true`
)

func (r *ProductRepository) List(ctx context.Context, limit int) ([]*domain.Product, error) {
	const q = `
		SELECT p.id, p.name, p.article, p.image_url, p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		ORDER BY p.created_at DESC, p.id
		LIMIT $1`
	rows, err := r.db.Querier(ctx).Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("query products: %w", err)
	}
	defer rows.Close()
	return scanProducts(rows)
}

// Search — поиск карточек для поля ввода «по мере набора»: подстрока (ILIKE,
// ускоряется тем же gin_trgm-индексом) плюс нечёткое совпадение слова
// (word_similarity, `%>`) для опечаток. Оператор `%` (обычный similarity) здесь
// не подходит: у короткого запроса мало триграмм и он не проходит порог против
// длинных названий. Сортировка — по похожести слова, точные подстроки выше.
func (r *ProductRepository) Search(ctx context.Context, query string, limit int) ([]*domain.Product, error) {
	const q = `
		SELECT p.id, p.name, p.article, p.image_url, p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		WHERE p.name ILIKE '%' || $1 || '%' OR $1 %> p.name
		ORDER BY word_similarity($1, p.name) DESC, p.name
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
		SELECT p.id, p.name, p.article, p.image_url, p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		WHERE p.id = $1`
	var p domain.Product
	err := r.db.Querier(ctx).QueryRow(ctx, q, id).
		Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CreatedAt, &p.CoverImageID)
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
		if err := rows.Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CreatedAt, &p.CoverImageID); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		out = append(out, &p)
	}
	return out, rows.Err()
}
