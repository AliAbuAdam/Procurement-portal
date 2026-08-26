// Package domain — доменные модели и интерфейсы слоя pricing.
package domain

import (
	"context"
	"errors"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrValidation = errors.New("validation failed")
)

// PriceTier — уровень цены для сравнения.
type PriceTier string

const (
	TierBase PriceTier = "base" // базовая (розничная)
	TierOpt  PriceTier = "opt"  // опт
	TierBulk PriceTier = "bulk" // крупный опт
)

// PriceOffer — цены и наличие товара у конкретного поставщика.
type PriceOffer struct {
	SupplierID   string
	SupplierName string
	Price        float64 // базовая (розничная)
	Currency     string
	InStock      bool
	StockQty     int64
	UpdatedAt    string
	PriceOpt     float64 // 0 = поставщик не дал
	PriceBulk    float64 // 0 = поставщик не дал
}

// TierPrice — цена предложения на заданном уровне (0 = не задана).
func (o *PriceOffer) TierPrice(t PriceTier) float64 {
	switch t {
	case TierOpt:
		return o.PriceOpt
	case TierBulk:
		return o.PriceBulk
	default:
		return o.Price
	}
}

// Comparison — результат сравнения цен по товарной карточке.
type Comparison struct {
	ProductID          string
	Offers             []*PriceOffer
	CheapestSupplierID string
}

// PriceRepository — контракт хранилища цен.
type PriceRepository interface {
	OffersByProduct(ctx context.Context, productID string) ([]*PriceOffer, error)
}
