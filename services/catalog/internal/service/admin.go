package service

import (
	"context"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// AdminService — необратимые служебные операции. Ролевой доступ обеспечивает
// gateway (только admin); здесь — только транзакционность.
type AdminService struct {
	txm  *postgres.TxManager
	repo domain.AdminRepository
}

func NewAdminService(txm *postgres.TxManager, repo domain.AdminRepository) *AdminService {
	return &AdminService{txm: txm, repo: repo}
}

// WipeData очищает данные каталога одной транзакцией: либо всё, либо ничего.
func (s *AdminService) WipeData(ctx context.Context, includeSuppliers bool) (*domain.WipeResult, error) {
	var res *domain.WipeResult
	err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
		var err error
		res, err = s.repo.Wipe(ctx, includeSuppliers)
		return err
	})
	if err != nil {
		return nil, err
	}
	return res, nil
}
