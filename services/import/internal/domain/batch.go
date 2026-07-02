// Package domain — доменные модели и интерфейсы слоя import.
package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrValidation = errors.New("validation failed")
)

// ImportStatus — статус обработки загруженного прайса.
type ImportStatus string

const (
	StatusPending    ImportStatus = "pending"
	StatusProcessing ImportStatus = "processing"
	StatusDone       ImportStatus = "done"
	StatusFailed     ImportStatus = "failed"
)

// ImportBatch — загруженный прайс поставщика (файл Excel/CSV).
// Сам парсинг строк будет реализован в фазе 1 асинхронно.
type ImportBatch struct {
	ID          string
	SupplierID  string
	FileName    string
	Status      ImportStatus
	RowsTotal   int
	RowsMatched int
	CreatedBy   string
	CreatedAt   time.Time
}

// ImportRepository — контракт хранилища загрузок.
type ImportRepository interface {
	Create(ctx context.Context, b *ImportBatch) error
	GetByID(ctx context.Context, id string) (*ImportBatch, error)
	ListBySupplier(ctx context.Context, supplierID string) ([]*ImportBatch, error)
	UpdateResult(ctx context.Context, id string, status ImportStatus, rowsTotal int) error
}
