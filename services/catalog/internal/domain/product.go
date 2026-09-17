package domain

import (
	"context"
	"errors"
	"time"
)

// ErrProductNotFound — карточка не найдена.
var ErrProductNotFound = errors.New("product not found")

// ProductAttr — одна характеристика карточки («Материал» → «Сталь»).
// Хранится в jsonb-массиве: порядок задаёт пользователь.
type ProductAttr struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Product — мастер-карточка номенклатуры, к которой сопоставляются строки прайсов.
type Product struct {
	ID           string
	Name         string
	Article      string
	ImageURL     string // легаси: внешний URL фото (новые фото — в product_images)
	CoverImageID string // id первого фото галереи ("" — фото нет)
	CategoryID   string // категория витрины ("" — без категории)
	Description  string
	Attrs        []ProductAttr
	Archived     bool // скрыт с витрины
	CreatedAt    time.Time
}

// Значения сортировки ProductFilter.Sort.
const (
	SortNew       = ""           // новые сверху (умолчание)
	SortName      = "name"       // по алфавиту
	SortPriceAsc  = "price_asc"  // по минимальной актуальной цене
	SortPriceDesc = "price_desc" // по минимальной актуальной цене, дорогие сверху
)

// ProductFilter — параметры выборки карточек (витрина и админ-списки).
type ProductFilter struct {
	Query           string // непустой — поиск по имени и артикулу
	CategoryID      string // категория и подкатегории; "none" — без категории
	IncludeArchived bool   // true — включая скрытые (админ-экраны)
	Sort            string // см. Sort*-константы
	InStock         bool   // только товары с наличием у поставщиков
	PriceMin        float64
	PriceMax        float64
	SupplierID      string // только товары с предложением этого поставщика
	Limit           int
	Offset          int
}

// ProductRepository — хранилище карточек (схема catalog).
type ProductRepository interface {
	Create(ctx context.Context, p *Product) error
	// List — выборка под фильтром; total — всего карточек под фильтром
	// (без пагинации), для «Показать ещё».
	List(ctx context.Context, f ProductFilter) (items []*Product, total int, err error)
	GetByID(ctx context.Context, id string) (*Product, error)
	// Update — полная замена редактируемых полей карточки.
	Update(ctx context.Context, p *Product) error
	// Delete удаляет карточку; сопоставления и фото каскадом (FK).
	Delete(ctx context.Context, id string) error
	// FindByArticle — карточка с точно таким артикулом (без учёта регистра);
	// (nil, nil) — не найдена. Для автосопоставления: артикул — самый
	// надёжный признак совпадения товара у разных поставщиков.
	FindByArticle(ctx context.Context, article string) (*Product, error)
	// SetCategory назначает категорию карточкам (categoryID "" — снять).
	// Возвращает число обновлённых строк.
	SetCategory(ctx context.Context, ids []string, categoryID string) (int, error)
}
