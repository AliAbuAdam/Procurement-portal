package domain

import "context"

// ColumnMapping — соответствие колонок файла полям. Индекс 0-based, -1 = нет.
type ColumnMapping struct {
	Name      int
	Article   int
	Price     int // базовая (розничная) цена
	Stock     int
	Currency  int
	PriceOpt  int // оптовая цена
	PriceBulk int // крупный опт
	Category  int // категория в терминах поставщика
	Photo     int // ссылка (URL) на фото товара
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
	PriceOpt   float64 // 0 = в прайсе не было
	PriceBulk  float64 // 0 = в прайсе не было
	RawCategory string // категория из прайса поставщика ("" — не было)
	PhotoURL    string // ссылка на фото из прайса ("" — не было или не URL)
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
	// DeleteAll — очистка всех строк прайсов (админ). Возвращает число удалённых.
	DeleteAll(ctx context.Context) (int64, error)
}
