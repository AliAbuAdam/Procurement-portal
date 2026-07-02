package domain

import "context"

// ColumnMapping — соответствие колонок файла полям. Индекс 0-based, -1 = нет.
type ColumnMapping struct {
	Name     int
	Article  int
	Price    int
	Stock    int
	Currency int
}

// SupplierOffer — «сырая» строка прайса до сопоставления с карточкой (фаза 2).
type SupplierOffer struct {
	ID         string
	BatchID    string
	SupplierID string
	RowNum     int
	RawName    string
	RawArticle string
	Price      float64
	Currency   string
	InStock    bool
	StockQty   int64
}

// ParsedSheet — результат разбора файла: заголовки и строки данных.
type ParsedSheet struct {
	Headers []string
	Rows    [][]string
}

// OfferRepository — хранилище сырых предложений (в одной транзакции с батчем).
type OfferRepository interface {
	InsertOffers(ctx context.Context, offers []*SupplierOffer) error
	ListOffers(ctx context.Context, batchID string, limit, offset int) ([]*SupplierOffer, int, error)
}
