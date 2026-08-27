package domain

import "context"

// WipeResult — сколько строк удалила очистка данных каталога.
type WipeResult struct {
	Products   int64
	Images     int64
	Matches    int64
	Categories int64
	Suppliers  int64
}

// AdminRepository — служебные операции (полная очистка данных).
type AdminRepository interface {
	Wipe(ctx context.Context, includeSuppliers bool) (*WipeResult, error)
}
