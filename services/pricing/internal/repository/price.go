// Package repository — доступ к данным pricing через pgx.
package repository

import (
	"context"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/pricing/internal/domain"
)

type PriceRepository struct {
	db *postgres.TxManager
}

func NewPriceRepository(db *postgres.TxManager) *PriceRepository {
	return &PriceRepository{db: db}
}

// OffersByProduct возвращает актуальную цену каждого поставщика по товару.
// Считается «вживую»: подтверждённые сопоставления (catalog.offer_matches)
// джойнятся с сырыми строками прайсов (importer.supplier_offers) и по каждому
// поставщику берётся строка из самого свежего импорта. Таблицу price_records
// не используем — так цена всегда актуальна без отдельной синхронизации.
// Это осознанный cross-schema read (одна БД на все сервисы).
func (r *PriceRepository) OffersByProduct(ctx context.Context, productID string) ([]*domain.PriceOffer, error) {
	const q = `
		SELECT DISTINCT ON (o.supplier_id)
		    o.supplier_id,
		    s.name AS supplier_name,
		    o.price,
		    o.currency,
		    o.in_stock,
		    o.stock_qty,
		    to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
		FROM catalog.offer_matches m
		JOIN importer.supplier_offers o ON o.id = m.offer_id
		JOIN importer.import_batches  b ON b.id = o.batch_id
		JOIN catalog.suppliers        s ON s.id = o.supplier_id
		WHERE m.product_id = $1
		ORDER BY o.supplier_id, b.created_at DESC`
	rows, err := r.db.Querier(ctx).Query(ctx, q, productID)
	if err != nil {
		return nil, fmt.Errorf("query offers: %w", err)
	}
	defer rows.Close()

	var out []*domain.PriceOffer
	for rows.Next() {
		var o domain.PriceOffer
		if err := rows.Scan(&o.SupplierID, &o.SupplierName, &o.Price, &o.Currency, &o.InStock, &o.StockQty, &o.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan offer: %w", err)
		}
		out = append(out, &o)
	}
	return out, rows.Err()
}
