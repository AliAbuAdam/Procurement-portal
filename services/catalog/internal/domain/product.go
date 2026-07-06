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
	ID        string
	Name      string
	Article   string
	ImageURL  string
	CreatedAt time.Time
}

// ProductRepository — хранилище карточек (схема catalog).
type ProductRepository interface {
	Create(ctx context.Context, p *Product) error
	List(ctx context.Context, limit int) ([]*Product, error)
	// Search — триграммный поиск по имени (pg_trgm), от самых похожих.
	Search(ctx context.Context, query string, limit int) ([]*Product, error)
	GetByID(ctx context.Context, id string) (*Product, error)
}
