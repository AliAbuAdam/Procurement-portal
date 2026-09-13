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
	S3Key       string // ключ оригинала в S3 ("" — байты в Postgres)
	S3ThumbKey  string // ключ миниатюры в S3 ("" — миниатюры в S3 нет)
	CreatedAt   time.Time
}

// ImageStore — объектное хранилище байтов фото (S3). nil-хранилище означает
// «S3 не настроен» — байты живут в Postgres (локальная разработка).
type ImageStore interface {
	Put(ctx context.Context, key string, data []byte, contentType string) error
	Get(ctx context.Context, key string) ([]byte, error)
	// Delete — best-effort удаление объектов (ошибки логируются, не валят запрос).
	Delete(ctx context.Context, keys ...string) error
	// DeletePrefix удаляет все объекты с данным префиксом (админ-очистка).
	DeletePrefix(ctx context.Context, prefix string) error
}

// ProductImageRepository — хранилище метаданных фото (схема catalog).
type ProductImageRepository interface {
	// ListByProduct — метаданные фото карточки по порядку (без байтов).
	ListByProduct(ctx context.Context, productID string) ([]*ProductImage, error)
	CountByProduct(ctx context.Context, productID string) (int, error)
	Insert(ctx context.Context, img *ProductImage) error
	// GetData — content_type, байты (если фото в Postgres) и ключ S3
	// (если фото в S3): ровно одно из двух непусто.
	GetData(ctx context.Context, id string, thumb bool) (contentType string, data []byte, s3Key string, err error)
	// SetS3Keys помечает фото перенесённым в S3 и обнуляет байты в Postgres.
	SetS3Keys(ctx context.Context, id, key, thumbKey string) error
	// Delete удаляет строку и возвращает её S3-ключи для очистки хранилища.
	Delete(ctx context.Context, id string) (s3Key, s3ThumbKey string, err error)
	// Reorder выставляет position по порядку ids (только фото этой карточки).
	Reorder(ctx context.Context, productID string, ids []string) error
	// ListUnmigrated — фото, чьи байты ещё в Postgres (для фоновой миграции в S3).
	ListUnmigrated(ctx context.Context, limit int) ([]*ProductImage, error)
}
