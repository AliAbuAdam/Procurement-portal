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
// предложение на заданном уровне цены (base/opt/bulk). Соревнуются только
// поставщики, у которых цена этого уровня задана (>0); среди них предложения
// в наличии предпочтительнее.
func (s *PriceService) CompareByProduct(ctx context.Context, productID string, tier domain.PriceTier) (*domain.Comparison, error) {
	productID = strings.TrimSpace(productID)
	if productID == "" {
		return nil, fmt.Errorf("%w: product_id is required", domain.ErrValidation)
	}
	switch tier {
	case domain.TierBase, domain.TierOpt, domain.TierBulk:
	case "":
		tier = domain.TierBase
	default:
		return nil, fmt.Errorf("%w: unknown price_tier %q", domain.ErrValidation, tier)
	}

	offers, err := s.prices.OffersByProduct(ctx, productID)
	if err != nil {
		return nil, err
	}

	cmp := &domain.Comparison{ProductID: productID, Offers: offers}
	var best *domain.PriceOffer
	for _, o := range offers {
		if o.TierPrice(tier) <= 0 {
			continue
		}
		if best == nil || betterOffer(o, best, tier) {
			best = o
		}
	}
	if best != nil {
		cmp.CheapestSupplierID = best.SupplierID
	}
	return cmp, nil
}

// betterOffer: предложения в наличии всегда предпочтительнее; при равном
// статусе наличия — дешевле на выбранном уровне цены.
func betterOffer(a, b *domain.PriceOffer, tier domain.PriceTier) bool {
	if a.InStock != b.InStock {
		return a.InStock
	}
	return a.TierPrice(tier) < b.TierPrice(tier)
}
