package service

import (
	"context"
	"log"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// AdminService — необратимые служебные операции. Ролевой доступ обеспечивает
// gateway (только admin); здесь — только транзакционность.
type AdminService struct {
	txm   *postgres.TxManager
	repo  domain.AdminRepository
	store domain.ImageStore // S3 с фото (nil — не настроен)
}

func NewAdminService(txm *postgres.TxManager, repo domain.AdminRepository, store domain.ImageStore) *AdminService {
	return &AdminService{txm: txm, repo: repo, store: store}
}

// WipeData очищает данные каталога одной транзакцией: либо всё, либо ничего.
// Фото в S3 удаляются после успешного коммита: сирота в хранилище безопасен,
// а вот строка с ключом на удалённый объект — нет.
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
	if s.store != nil {
		if err := s.store.DeletePrefix(ctx, "products/"); err != nil {
			log.Printf("admin wipe: s3 cleanup: %v", err)
		}
	}
	return res, nil
}
