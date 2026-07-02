// Package domain — доменные модели, ошибки и интерфейсы слоя catalog.
// Не зависит ни от gRPC/proto, ни от pgx: чистая бизнес-модель.
package domain

import (
	"context"
	"errors"
	"time"
)

// Доменные ошибки. Транспортный слой мапит их в коды gRPC.
var (
	ErrNotFound       = errors.New("not found")
	ErrValidation     = errors.New("validation failed")
	ErrSupplierExists = errors.New("supplier already exists")
)

// SupplierType — источник данных поставщика.
type SupplierType string

const (
	SupplierTypeUnspecified SupplierType = "unspecified"
	SupplierTypeExcel       SupplierType = "excel"   // прайсы файлами
	SupplierTypeAPI         SupplierType = "api"     // подключение по API
	SupplierTypeParsing     SupplierType = "parsing" // парсинг сайта
)

func (t SupplierType) Valid() bool {
	switch t {
	case SupplierTypeExcel, SupplierTypeAPI, SupplierTypeParsing:
		return true
	default:
		return false
	}
}

// Supplier — поставщик фурнитуры.
type Supplier struct {
	ID        string
	Name      string
	Type      SupplierType
	CreatedAt time.Time
}

// SupplierRepository — контракт хранилища поставщиков (реализуется в слое repository).
type SupplierRepository interface {
	Create(ctx context.Context, s *Supplier) error
	List(ctx context.Context, limit, offset int) ([]*Supplier, error)
	ExistsByName(ctx context.Context, name string) (bool, error)
}
