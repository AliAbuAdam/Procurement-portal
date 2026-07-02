package repository

import (
	"context"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/import/internal/domain"
	"github.com/jackc/pgx/v5"
)

type OfferRepository struct {
	db *postgres.TxManager
}

func NewOfferRepository(db *postgres.TxManager) *OfferRepository {
	return &OfferRepository{db: db}
}

// InsertOffers пакетно вставляет строки прайса (в транзакции с батчем).
func (r *OfferRepository) InsertOffers(ctx context.Context, offers []*domain.SupplierOffer) error {
	if len(offers) == 0 {
		return nil
	}
	rows := make([][]any, 0, len(offers))
	for _, o := range offers {
		rows = append(rows, []any{
			o.BatchID, o.SupplierID, o.RowNum, o.RawName, o.RawArticle,
			o.Price, o.Currency, o.InStock, o.StockQty,
		})
	}
	_, err := r.db.Querier(ctx).CopyFrom(
		ctx,
		pgx.Identifier{"importer", "supplier_offers"},
		[]string{"batch_id", "supplier_id", "row_num", "raw_name", "raw_article", "price", "currency", "in_stock", "stock_qty"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("copy offers: %w", err)
	}
	return nil
}

func (r *OfferRepository) ListOffers(ctx context.Context, batchID string, limit, offset int) ([]*domain.SupplierOffer, int, error) {
	var total int
	if err := r.db.Querier(ctx).
		QueryRow(ctx, `SELECT count(*) FROM importer.supplier_offers WHERE batch_id = $1`, batchID).
		Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count offers: %w", err)
	}

	const q = `
		SELECT id, batch_id, supplier_id, row_num, raw_name, raw_article, price, currency, in_stock, stock_qty
		FROM importer.supplier_offers
		WHERE batch_id = $1
		ORDER BY row_num
		LIMIT $2 OFFSET $3`
	rows, err := r.db.Querier(ctx).Query(ctx, q, batchID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list offers: %w", err)
	}
	defer rows.Close()

	var out []*domain.SupplierOffer
	for rows.Next() {
		var o domain.SupplierOffer
		if err := rows.Scan(&o.ID, &o.BatchID, &o.SupplierID, &o.RowNum, &o.RawName, &o.RawArticle, &o.Price, &o.Currency, &o.InStock, &o.StockQty); err != nil {
			return nil, 0, fmt.Errorf("scan offer: %w", err)
		}
		out = append(out, &o)
	}
	return out, total, rows.Err()
}
