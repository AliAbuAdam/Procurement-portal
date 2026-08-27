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
		INSERT INTO catalog.products (name, article, image_url, category_id)
		VALUES ($1, $2, $3, NULLIF($4, '')::uuid)
		RETURNING id, created_at`
	err := r.db.Querier(ctx).
		QueryRow(ctx, q, p.Name, p.Article, p.ImageURL, p.CategoryID).
		Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return categoryWriteErr("insert product", err)
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

// categoryFilter — фильтр «категория и все её подкатегории»; спец-значение
// "none" — только товары без категории. Плейсхолдер подставляется через fmt
// (номера различаются в List и Search). Двойной NULLIF гасит "" и "none" до
// NULL::uuid, поэтому каст не падает ни на одном значении.
const categoryFilter = `(%[1]s = ''
	OR (%[1]s = 'none' AND p.category_id IS NULL)
	OR p.category_id IN (
		WITH RECURSIVE cat AS (
			SELECT id FROM catalog.categories WHERE id = NULLIF(NULLIF(%[1]s, ''), 'none')::uuid
			UNION ALL
			SELECT c.id FROM catalog.categories c JOIN cat ON c.parent_id = cat.id
		)
		SELECT id FROM cat))`

func (r *ProductRepository) List(ctx context.Context, categoryID string, limit int) ([]*domain.Product, error) {
	q := `
		SELECT p.id, p.name, p.article, p.image_url, COALESCE(p.category_id::text, ''), p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		WHERE ` + fmt.Sprintf(categoryFilter, "$1") + `
		ORDER BY p.created_at DESC, p.id
		LIMIT $2`
	rows, err := r.db.Querier(ctx).Query(ctx, q, categoryID, limit)
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
func (r *ProductRepository) Search(ctx context.Context, query, categoryID string, limit int) ([]*domain.Product, error) {
	q := `
		SELECT p.id, p.name, p.article, p.image_url, COALESCE(p.category_id::text, ''), p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		WHERE (p.name ILIKE '%' || $1 || '%' OR $1 %> p.name)
		  AND ` + fmt.Sprintf(categoryFilter, "$2") + `
		ORDER BY word_similarity($1, p.name) DESC, p.name
		LIMIT $3`
	rows, err := r.db.Querier(ctx).Query(ctx, q, query, categoryID, limit)
	if err != nil {
		return nil, fmt.Errorf("search products: %w", err)
	}
	defer rows.Close()
	return scanProducts(rows)
}

func (r *ProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	const q = `
		SELECT p.id, p.name, p.article, p.image_url, COALESCE(p.category_id::text, ''), p.created_at, ` + coverSelect + `
		FROM catalog.products p` + coverJoin + `
		WHERE p.id = $1`
	var p domain.Product
	err := r.db.Querier(ctx).QueryRow(ctx, q, id).
		Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CategoryID, &p.CreatedAt, &p.CoverImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrProductNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get product: %w", err)
	}
	return &p, nil
}

func (r *ProductRepository) SetCategory(ctx context.Context, ids []string, categoryID string) (int, error) {
	const q = `
		UPDATE catalog.products
		SET category_id = NULLIF($2, '')::uuid, updated_at = now()
		WHERE id = ANY($1::uuid[])`
	tag, err := r.db.Querier(ctx).Exec(ctx, q, ids, categoryID)
	if err != nil {
		return 0, categoryWriteErr("set product category", err)
	}
	return int(tag.RowsAffected()), nil
}

func scanProducts(rows pgx.Rows) ([]*domain.Product, error) {
	var out []*domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CategoryID, &p.CreatedAt, &p.CoverImageID); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		out = append(out, &p)
	}
	return out, rows.Err()
}
