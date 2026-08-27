package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// CategoryService — дерево категорий витрины и привязки категорий поставщиков.
type CategoryService struct {
	txm        *postgres.TxManager
	categories domain.CategoryRepository
}

func NewCategoryService(txm *postgres.TxManager, categories domain.CategoryRepository) *CategoryService {
	return &CategoryService{txm: txm, categories: categories}
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

// --- категории поставщиков ---

func (s *CategoryService) ListSupplierCategories(ctx context.Context) ([]*domain.SupplierCategory, error) {
	return s.categories.ListSupplierCategories(ctx)
}

// MapSupplierCategory — привязать категорию поставщика к своей.
// createCategory=true — создать корневую категорию с именем rawCategory и
// привязать к ней (одной транзакцией). Пустой categoryID без create — снять
// привязку. Возвращает итоговый id категории ("" — привязка снята).
func (s *CategoryService) MapSupplierCategory(ctx context.Context, supplierID, rawCategory, categoryID string, createCategory bool) (string, error) {
	supplierID = strings.TrimSpace(supplierID)
	rawCategory = strings.TrimSpace(rawCategory)
	categoryID = strings.TrimSpace(categoryID)
	if supplierID == "" || rawCategory == "" {
		return "", fmt.Errorf("%w: supplier_id and raw_category are required", domain.ErrValidation)
	}

	if createCategory {
		err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
			c := &domain.Category{Name: rawCategory}
			if err := s.categories.Create(ctx, c); err != nil {
				return err
			}
			categoryID = c.ID
			return s.categories.UpsertMapping(ctx, supplierID, rawCategory, categoryID)
		})
		if err != nil {
			return "", err
		}
		return categoryID, nil
	}

	if categoryID == "" {
		return "", s.categories.DeleteMapping(ctx, supplierID, rawCategory)
	}
	if err := s.categories.UpsertMapping(ctx, supplierID, rawCategory, categoryID); err != nil {
		return "", err
	}
	return categoryID, nil
}

func (s *CategoryService) ApplyMappings(ctx context.Context) (int, error) {
	return s.categories.ApplyMappings(ctx)
}
