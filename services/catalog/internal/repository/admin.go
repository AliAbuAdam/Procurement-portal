package repository

import (
	"context"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// AdminRepository — служебные операции над данными каталога.
type AdminRepository struct {
	db *postgres.TxManager
}

func NewAdminRepository(db *postgres.TxManager) *AdminRepository {
	return &AdminRepository{db: db}
}

// Wipe удаляет данные каталога. Порядок продиктован FK: сначала зависимые
// (сопоставления, фото), затем карточки и категории. Вызывать внутри
// транзакции (см. AdminService) — иначе частичная очистка при сбое.
func (r *AdminRepository) Wipe(ctx context.Context, includeSuppliers bool) (*domain.WipeResult, error) {
	res := &domain.WipeResult{}
	steps := []struct {
		dst *int64
		sql string
	}{
		{&res.Matches, `DELETE FROM catalog.offer_matches`},
		{&res.Images, `DELETE FROM catalog.product_images`},
		{&res.Products, `DELETE FROM catalog.products`},
		{&res.Categories, `DELETE FROM catalog.categories`},
	}
	if includeSuppliers {
		steps = append(steps, struct {
			dst *int64
			sql string
		}{&res.Suppliers, `DELETE FROM catalog.suppliers`})
	}
	for _, st := range steps {
		tag, err := r.db.Querier(ctx).Exec(ctx, st.sql)
		if err != nil {
			return nil, fmt.Errorf("wipe catalog: %w", err)
		}
		*st.dst = tag.RowsAffected()
	}
	return res, nil
}
