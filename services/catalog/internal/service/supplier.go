// Package service — бизнес-логика catalog. Оркестрирует репозитории и
// управляет транзакциями через TxManager. Не знает про gRPC/pgx напрямую.
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

type SupplierService struct {
	txm       *postgres.TxManager
	suppliers domain.SupplierRepository
}

func NewSupplierService(txm *postgres.TxManager, suppliers domain.SupplierRepository) *SupplierService {
	return &SupplierService{txm: txm, suppliers: suppliers}
}

func (s *SupplierService) Create(ctx context.Context, name string, typ domain.SupplierType, city, address, logo string, status domain.SupplierStatus) (*domain.Supplier, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	if !typ.Valid() {
		return nil, fmt.Errorf("%w: invalid supplier type %q", domain.ErrValidation, typ)
	}
	if status == "" {
		status = domain.SupplierStatusNew
	}
	if !status.Valid() {
		return nil, fmt.Errorf("%w: invalid supplier status %q", domain.ErrValidation, status)
	}

	sup := &domain.Supplier{
		Name:    name,
		Type:    typ,
		City:    strings.TrimSpace(city),
		Address: strings.TrimSpace(address),
		Logo:    strings.TrimSpace(logo),
		Status:  status,
	}

	// Проверка уникальности и вставка — в одной транзакции, чтобы не словить
	// гонку между ExistsByName и Create.
	err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
		exists, err := s.suppliers.ExistsByName(ctx, name)
		if err != nil {
			return err
		}
		if exists {
			return fmt.Errorf("%w: %s", domain.ErrSupplierExists, name)
		}
		return s.suppliers.Create(ctx, sup)
	})
	if err != nil {
		return nil, err
	}
	return sup, nil
}

// Update меняет данные существующего поставщика. Конфликт имени с другим
// поставщиком ловится уникальным индексом на уровне БД (ErrSupplierExists).
func (s *SupplierService) Update(ctx context.Context, id, name string, typ domain.SupplierType, city, address, logo string, status domain.SupplierStatus) (*domain.Supplier, error) {
	id = strings.TrimSpace(id)
	name = strings.TrimSpace(name)
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	if !typ.Valid() {
		return nil, fmt.Errorf("%w: invalid supplier type %q", domain.ErrValidation, typ)
	}
	if status == "" {
		status = domain.SupplierStatusNew
	}
	if !status.Valid() {
		return nil, fmt.Errorf("%w: invalid supplier status %q", domain.ErrValidation, status)
	}

	sup := &domain.Supplier{
		ID:      id,
		Name:    name,
		Type:    typ,
		City:    strings.TrimSpace(city),
		Address: strings.TrimSpace(address),
		Logo:    strings.TrimSpace(logo),
		Status:  status,
	}
	if err := s.suppliers.Update(ctx, sup); err != nil {
		return nil, err
	}
	return sup, nil
}

func (s *SupplierService) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.suppliers.Delete(ctx, id)
}

func (s *SupplierService) List(ctx context.Context, limit, offset int) ([]*domain.Supplier, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	return s.suppliers.List(ctx, limit, offset)
}
