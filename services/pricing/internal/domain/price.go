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

// PriceOffer — цена и наличие товара у конкретного поставщика.
type PriceOffer struct {
	SupplierID   string
	SupplierName string
	Price        float64
	Currency     string
	InStock      bool
	StockQty     int64
	UpdatedAt    string
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
