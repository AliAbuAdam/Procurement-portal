package domain

import (
	"context"
	"errors"
	"time"
)

// ErrCategoryNotFound — категория не найдена.
var ErrCategoryNotFound = errors.New("category not found")

// ErrCategoryCycle — попытка перенести категорию в собственное поддерево.
var ErrCategoryCycle = errors.New("category cycle")

// Category — узел дерева категорий витрины. Дерево собирается клиентом из
// плоского списка; ProductCount — товары непосредственно в узле (счётчики
// с учётом подкатегорий агрегирует UI).
type Category struct {
	ID           string
	ParentID     string // "" — корневая
	Name         string
	Position     int
	ProductCount int
	CreatedAt    time.Time
}

// SupplierCategory — категория в терминах поставщика (текст из его прайсов)
// и её привязка к категории витрины.
type SupplierCategory struct {
	SupplierID   string
	SupplierName string
	RawCategory  string
	OffersCount  int
	CategoryID   string // "" — не привязана
}

// CategoryRepository — хранилище категорий (схема catalog).
// Методы Supplier*/Mapped* читают строки прайсов из схемы importer —
// осознанный cross-schema read (одна БД, та же политика, что у matching).
type CategoryRepository interface {
	List(ctx context.Context) ([]*Category, error)
	// UncategorizedCount — сколько товаров без категории.
	UncategorizedCount(ctx context.Context) (int, error)
	Create(ctx context.Context, c *Category) error
	// Update меняет имя и родителя; перенос в собственное поддерево -> ErrCategoryCycle.
	Update(ctx context.Context, c *Category) error
	Delete(ctx context.Context, id string) error

	// ListSupplierCategories — уникальные категории из прайсов + привязки.
	ListSupplierCategories(ctx context.Context) ([]*SupplierCategory, error)
	// UpsertMapping привязывает категорию поставщика к категории витрины.
	UpsertMapping(ctx context.Context, supplierID, rawCategory, categoryID string) error
	// DeleteMapping снимает привязку.
	DeleteMapping(ctx context.Context, supplierID, rawCategory string) error
	// MappedCategory — категория витрины по привязке ("" — привязки нет).
	MappedCategory(ctx context.Context, supplierID, rawCategory string) (string, error)
	// ApplyMappings массово проставляет категории товарам БЕЗ категории по
	// привязкам их сопоставленных строк. Возвращает число обновлённых товаров.
	ApplyMappings(ctx context.Context) (int, error)
}
