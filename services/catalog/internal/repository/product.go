package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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

// productCols / coverJoin — общий список колонок карточки для выборок:
// attrs — jsonb-массив пар {name, value}; обложка (id первого фото галереи) —
// LATERAL-подзапрос по индексу (product_id, position, created_at), байты не тянем.
const (
	productCols = `p.id, p.name, p.article, p.image_url, COALESCE(p.category_id::text, ''), p.created_at,
		COALESCE(c.id::text, '') AS cover_image_id, p.description, p.attrs, p.archived`
	coverJoin = `
		LEFT JOIN LATERAL (
			SELECT id FROM catalog.product_images
			WHERE product_id = p.id
			ORDER BY position, created_at
			LIMIT 1
		) c ON true`
)

// categoryFilter — фильтр «категория и все её подкатегории»; спец-значение
// "none" — только товары без категории. Плейсхолдер подставляется через fmt.
// Двойной NULLIF гасит "" и "none" до NULL::uuid, поэтому каст не падает
// ни на одном значении.
const categoryFilter = `(%[1]s = ''
	OR (%[1]s = 'none' AND p.category_id IS NULL)
	OR p.category_id IN (
		WITH RECURSIVE cat AS (
			SELECT id FROM catalog.categories WHERE id = NULLIF(NULLIF(%[1]s, ''), 'none')::uuid
			UNION ALL
			SELECT c.id FROM catalog.categories c JOIN cat ON c.parent_id = cat.id
		)
		SELECT id FROM cat))`

// priceCTE — актуальные предложения поставщиков: тот же живой джойн, что в
// pricing (свежайший импорт каждого поставщика). Подключается к выборке только
// когда запрошены сортировка/фильтры по цене, наличию или поставщику —
// осознанный cross-schema read (одна БД на все сервисы).
const priceCTE = `WITH latest AS (
		SELECT DISTINCT ON (m.product_id, o.supplier_id)
		    m.product_id, o.supplier_id, o.price, o.in_stock
		FROM catalog.offer_matches m
		JOIN importer.supplier_offers o ON o.id = m.offer_id
		JOIN importer.import_batches  b ON b.id = o.batch_id
		ORDER BY m.product_id, o.supplier_id, b.created_at DESC
	), agg AS (
		SELECT product_id,
		       min(price) FILTER (WHERE price > 0) AS min_price,
		       bool_or(in_stock) AS in_stock
		FROM latest GROUP BY product_id
	)
	`

// List — единая выборка карточек: поиск, фильтры, сортировка, пагинация.
// total — всего строк под фильтром (окно count(*) OVER()); на страницах за
// концом выборки строк нет и total возвращается нулевым — фронт к этому готов.
func (r *ProductRepository) List(ctx context.Context, f domain.ProductFilter) ([]*domain.Product, int, error) {
	var (
		args  []any
		conds []string
	)
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	// Джойн цен нужен только для ценовых сортировок и фильтров.
	needPrices := f.Sort == domain.SortPriceAsc || f.Sort == domain.SortPriceDesc ||
		f.InStock || f.PriceMin > 0 || f.PriceMax > 0 || f.SupplierID != ""

	if !f.IncludeArchived {
		conds = append(conds, "NOT p.archived")
	}
	conds = append(conds, fmt.Sprintf(categoryFilter, arg(f.CategoryID)))
	if f.Query != "" {
		// Подстрока по имени и артикулу (ILIKE, ускоряется gin_trgm) + нечёткое
		// совпадение слова для опечаток; см. Search-комментарий в истории —
		// оператор `%` для короткого запроса не годится.
		q := arg(f.Query)
		conds = append(conds, fmt.Sprintf(
			"(p.name ILIKE '%%' || %[1]s || '%%' OR p.article ILIKE '%%' || %[1]s || '%%' OR %[1]s %%> p.name)", q))
	}
	if f.InStock {
		conds = append(conds, "COALESCE(agg.in_stock, false)")
	}
	if f.PriceMin > 0 {
		conds = append(conds, "agg.min_price >= "+arg(f.PriceMin))
	}
	if f.PriceMax > 0 {
		conds = append(conds, "agg.min_price <= "+arg(f.PriceMax))
	}
	if f.SupplierID != "" {
		conds = append(conds, "EXISTS (SELECT 1 FROM latest l WHERE l.product_id = p.id AND l.supplier_id = "+arg(f.SupplierID)+"::uuid)")
	}

	var order string
	switch {
	case f.Sort == domain.SortPriceAsc:
		order = "agg.min_price ASC NULLS LAST, p.name, p.id"
	case f.Sort == domain.SortPriceDesc:
		order = "agg.min_price DESC NULLS LAST, p.name, p.id"
	case f.Sort == domain.SortName:
		order = "p.name, p.id"
	case f.Query != "":
		// Поиск без явной сортировки — самые похожие сверху.
		order = "word_similarity(" + arg(f.Query) + ", p.name) DESC, p.name, p.id"
	default:
		order = "p.created_at DESC, p.id"
	}

	q := ""
	if needPrices {
		q = priceCTE
	}
	q += `SELECT ` + productCols + `, count(*) OVER() AS total
		FROM catalog.products p`
	if needPrices {
		q += `
		LEFT JOIN agg ON agg.product_id = p.id`
	}
	q += coverJoin + `
		WHERE ` + strings.Join(conds, "\n\t\t  AND ") + `
		ORDER BY ` + order + `
		LIMIT ` + arg(f.Limit) + ` OFFSET ` + arg(f.Offset)

	rows, err := r.db.Querier(ctx).Query(ctx, q, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query products: %w", err)
	}
	defer rows.Close()

	var (
		out   []*domain.Product
		total int
	)
	for rows.Next() {
		p, attrs := &domain.Product{}, []byte(nil)
		if err := rows.Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CategoryID, &p.CreatedAt,
			&p.CoverImageID, &p.Description, &attrs, &p.Archived, &total); err != nil {
			return nil, 0, fmt.Errorf("scan product: %w", err)
		}
		if err := unmarshalAttrs(attrs, p); err != nil {
			return nil, 0, err
		}
		out = append(out, p)
	}
	return out, total, rows.Err()
}

func (r *ProductRepository) GetByID(ctx context.Context, id string) (*domain.Product, error) {
	q := `
		SELECT ` + productCols + `
		FROM catalog.products p` + coverJoin + `
		WHERE p.id = $1`
	p, err := scanProduct(r.db.Querier(ctx).QueryRow(ctx, q, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrProductNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get product: %w", err)
	}
	return p, nil
}

// Update — полная замена редактируемых полей карточки.
func (r *ProductRepository) Update(ctx context.Context, p *domain.Product) error {
	attrs, err := json.Marshal(attrsOrEmpty(p.Attrs))
	if err != nil {
		return fmt.Errorf("marshal attrs: %w", err)
	}
	const q = `
		UPDATE catalog.products
		SET name = $2, article = $3, description = $4, attrs = $5,
		    archived = $6, category_id = NULLIF($7, '')::uuid, updated_at = now()
		WHERE id = $1`
	tag, err := r.db.Querier(ctx).Exec(ctx, q, p.ID, p.Name, p.Article, p.Description, attrs, p.Archived, p.CategoryID)
	if err != nil {
		return categoryWriteErr("update product", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrProductNotFound
	}
	return nil
}

// Delete — удаление карточки; сопоставления и фото удаляются каскадом (FK).
func (r *ProductRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Querier(ctx).Exec(ctx, `DELETE FROM catalog.products WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete product: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrProductNotFound
	}
	return nil
}

func (r *ProductRepository) FindByArticle(ctx context.Context, article string) (*domain.Product, error) {
	// lower(article) попадает в частичный индекс products_article_idx.
	q := `
		SELECT ` + productCols + `
		FROM catalog.products p` + coverJoin + `
		WHERE p.article <> '' AND lower(p.article) = lower($1)
		ORDER BY p.created_at, p.id
		LIMIT 1`
	p, err := scanProduct(r.db.Querier(ctx).QueryRow(ctx, q, article))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find product by article: %w", err)
	}
	return p, nil
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

func scanProduct(row pgx.Row) (*domain.Product, error) {
	p, attrs := &domain.Product{}, []byte(nil)
	if err := row.Scan(&p.ID, &p.Name, &p.Article, &p.ImageURL, &p.CategoryID, &p.CreatedAt,
		&p.CoverImageID, &p.Description, &attrs, &p.Archived); err != nil {
		return nil, err
	}
	if err := unmarshalAttrs(attrs, p); err != nil {
		return nil, err
	}
	return p, nil
}

func unmarshalAttrs(raw []byte, p *domain.Product) error {
	if len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, &p.Attrs); err != nil {
		return fmt.Errorf("unmarshal product attrs: %w", err)
	}
	return nil
}

// attrsOrEmpty — nil сериализуется в jsonb как SQL NULL, а колонка NOT NULL;
// пустой список пишем явным [].
func attrsOrEmpty(a []domain.ProductAttr) []domain.ProductAttr {
	if a == nil {
		return []domain.ProductAttr{}
	}
	return a
}
