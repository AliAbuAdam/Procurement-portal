package domain

import (
	"context"
	"errors"
	"time"
)

// ErrProductNotFound — карточка не найдена.
var ErrProductNotFound = errors.New("product not found")

// Product — мастер-карточка номенклатуры, к которой сопоставляются строки прайсов.
type Product struct {
	ID           string
	Name         string
	Article      string
	ImageURL     string // легаси: внешний URL фото (новые фото — в product_images)
	CoverImageID string // id первого фото галереи ("" — фото нет)
	CategoryID   string // категория витрины ("" — без категории)
	CreatedAt    time.Time
}

// ProductRepository — хранилище карточек (схема catalog).
// Непустой categoryID в List/Search сужает выборку категорией и всеми её
// подкатегориями (recursive CTE в репозитории).
type ProductRepository interface {
	Create(ctx context.Context, p *Product) error
	List(ctx context.Context, categoryID string, limit int) ([]*Product, error)
	// Search — триграммный поиск по имени (pg_trgm), от самых похожих.
	Search(ctx context.Context, query, categoryID string, limit int) ([]*Product, error)
	GetByID(ctx context.Context, id string) (*Product, error)
	// SetCategory назначает категорию карточкам (categoryID "" — снять).
	// Возвращает число обновлённых строк.
	SetCategory(ctx context.Context, ids []string, categoryID string) (int, error)
}
