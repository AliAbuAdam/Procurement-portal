// Package service — бизнес-логика pricing.
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/services/pricing/internal/domain"
)

type PriceService struct {
	prices domain.PriceRepository
}

func NewPriceService(prices domain.PriceRepository) *PriceService {
	return &PriceService{prices: prices}
}

// CompareByProduct собирает цены поставщиков по товару и определяет самое дешёвое
// предложение среди тех, что в наличии (если наличия нет — среди всех).
func (s *PriceService) CompareByProduct(ctx context.Context, productID string) (*domain.Comparison, error) {
	productID = strings.TrimSpace(productID)
	if productID == "" {
		return nil, fmt.Errorf("%w: product_id is required", domain.ErrValidation)
	}

	offers, err := s.prices.OffersByProduct(ctx, productID)
	if err != nil {
		return nil, err
	}

	cmp := &domain.Comparison{ProductID: productID, Offers: offers}
	var best *domain.PriceOffer
	for _, o := range offers {
		if best == nil || betterOffer(o, best) {
			best = o
		}
	}
	if best != nil {
		cmp.CheapestSupplierID = best.SupplierID
	}
	return cmp, nil
}

// betterOffer: предложения в наличии всегда предпочтительнее; при равном
// статусе наличия — дешевле.
func betterOffer(a, b *domain.PriceOffer) bool {
	if a.InStock != b.InStock {
		return a.InStock
	}
	return a.Price < b.Price
}
