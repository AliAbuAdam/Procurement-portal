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

// CategoryRepository — хранилище категорий (схема catalog).
type CategoryRepository interface {
	List(ctx context.Context) ([]*Category, error)
	// UncategorizedCount — сколько товаров без категории.
	UncategorizedCount(ctx context.Context) (int, error)
	Create(ctx context.Context, c *Category) error
	// Update меняет имя и родителя; перенос в собственное поддерево -> ErrCategoryCycle.
	Update(ctx context.Context, c *Category) error
	Delete(ctx context.Context, id string) error
}
