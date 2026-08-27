package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/services/catalog/internal/domain"
)

// CategoryService — дерево категорий витрины.
type CategoryService struct {
	categories domain.CategoryRepository
}

func NewCategoryService(categories domain.CategoryRepository) *CategoryService {
	return &CategoryService{categories: categories}
}

// List — все категории плюс число товаров без категории (для пункта
// «Без категории» на витрине).
func (s *CategoryService) List(ctx context.Context) ([]*domain.Category, int, error) {
	list, err := s.categories.List(ctx)
	if err != nil {
		return nil, 0, err
	}
	uncat, err := s.categories.UncategorizedCount(ctx)
	if err != nil {
		return nil, 0, err
	}
	return list, uncat, nil
}

func (s *CategoryService) Create(ctx context.Context, name, parentID string) (*domain.Category, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	c := &domain.Category{Name: name, ParentID: strings.TrimSpace(parentID)}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CategoryService) Update(ctx context.Context, id, name, parentID string) (*domain.Category, error) {
	id = strings.TrimSpace(id)
	name = strings.TrimSpace(name)
	parentID = strings.TrimSpace(parentID)
	if id == "" || name == "" {
		return nil, fmt.Errorf("%w: id and name are required", domain.ErrValidation)
	}
	if parentID == id {
		return nil, domain.ErrCategoryCycle
	}
	c := &domain.Category{ID: id, Name: name, ParentID: parentID}
	if err := s.categories.Update(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *CategoryService) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.categories.Delete(ctx, id)
}
