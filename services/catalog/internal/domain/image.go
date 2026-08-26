package domain

import (
	"context"
	"errors"
	"time"
)

// ErrImageNotFound — фото не найдено.
var ErrImageNotFound = errors.New("image not found")

// MaxImagesPerProduct — лимит галереи карточки (требование заказчика: 6–10).
const MaxImagesPerProduct = 10

// ProductImage — фото карточки. Data/Thumb заполняются только при GetData.
type ProductImage struct {
	ID          string
	ProductID   string
	Position    int
	ContentType string
	Data        []byte
	Thumb       []byte
	CreatedAt   time.Time
}

// ProductImageRepository — хранилище фото (схема catalog).
type ProductImageRepository interface {
	// ListByProduct — метаданные фото карточки по порядку (без байтов).
	ListByProduct(ctx context.Context, productID string) ([]*ProductImage, error)
	CountByProduct(ctx context.Context, productID string) (int, error)
	Insert(ctx context.Context, img *ProductImage) error
	// GetData — content_type и байты (оригинал или миниатюра).
	GetData(ctx context.Context, id string, thumb bool) (contentType string, data []byte, err error)
	Delete(ctx context.Context, id string) error
	// Reorder выставляет position по порядку ids (только фото этой карточки).
	Reorder(ctx context.Context, productID string, ids []string) error
}
