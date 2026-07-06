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

// SupplierStatus — статус работы с поставщиком.
type SupplierStatus string

const (
	SupplierStatusNew      SupplierStatus = "new"      // Новый
	SupplierStatusActive   SupplierStatus = "active"   // В работе
	SupplierStatusInactive SupplierStatus = "inactive" // Не работаем
)

func (s SupplierStatus) Valid() bool {
	switch s {
	case SupplierStatusNew, SupplierStatusActive, SupplierStatusInactive:
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
	City      string
	Address   string
	Logo      string // URL или data-URL логотипа
	Status    SupplierStatus
}

// SupplierRepository — контракт хранилища поставщиков (реализуется в слое repository).
type SupplierRepository interface {
	Create(ctx context.Context, s *Supplier) error
	Update(ctx context.Context, s *Supplier) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, limit, offset int) ([]*Supplier, error)
	ExistsByName(ctx context.Context, name string) (bool, error)
}
