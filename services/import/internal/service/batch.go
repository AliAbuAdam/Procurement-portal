// Package service — бизнес-логика import: предпросмотр, разбор по маппингу,
// сохранение батча и сырых строк в одной транзакции.
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/import/internal/domain"
	"github.com/furnica/backend/services/import/internal/parser"
)

const previewRows = 10

type ImportService struct {
	txm     *postgres.TxManager
	batches domain.ImportRepository
	offers  domain.OfferRepository
}

func NewImportService(txm *postgres.TxManager, batches domain.ImportRepository, offers domain.OfferRepository) *ImportService {
	return &ImportService{txm: txm, batches: batches, offers: offers}
}

// Preview — результат предпросмотра файла.
type Preview struct {
	Headers   []string
	Rows      [][]string
	Suggested domain.ColumnMapping
	TotalRows int
}

func (s *ImportService) Preview(_ context.Context, fileName string, content []byte) (*Preview, error) {
	sheet, err := parser.Parse(fileName, content)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", domain.ErrValidation, err.Error())
	}
	sample := sheet.Rows
	if len(sample) > previewRows {
		sample = sample[:previewRows]
	}
	return &Preview{
		Headers:   sheet.Headers,
		Rows:      sample,
		Suggested: suggestMapping(sheet.Headers),
		TotalRows: len(sheet.Rows),
	}, nil
}

func (s *ImportService) Process(ctx context.Context, supplierID, fileName string, content []byte, m domain.ColumnMapping, createdBy string) (*domain.ImportBatch, error) {
	if strings.TrimSpace(supplierID) == "" {
		return nil, fmt.Errorf("%w: supplier_id is required", domain.ErrValidation)
	}
	if m.Name < 0 {
		return nil, fmt.Errorf("%w: не задана колонка названия", domain.ErrValidation)
	}

	sheet, err := parser.Parse(fileName, content)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", domain.ErrValidation, err.Error())
	}

	batch := &domain.ImportBatch{
		SupplierID: supplierID,
		FileName:   fileName,
		Status:     domain.StatusProcessing,
		CreatedBy:  createdBy,
	}

	err = s.txm.WithinTx(ctx, func(ctx context.Context) error {
		if err := s.batches.Create(ctx, batch); err != nil {
			return err
		}
		offers := s.buildOffers(batch, supplierID, sheet, m)
		if err := s.offers.InsertOffers(ctx, offers); err != nil {
			return err
		}
		batch.RowsTotal = len(offers)
		batch.Status = domain.StatusDone
		return s.batches.UpdateResult(ctx, batch.ID, domain.StatusDone, len(offers))
	})
	if err != nil {
		return nil, err
	}
	return batch, nil
}

func (s *ImportService) buildOffers(batch *domain.ImportBatch, supplierID string, sheet *domain.ParsedSheet, m domain.ColumnMapping) []*domain.SupplierOffer {
	offers := make([]*domain.SupplierOffer, 0, len(sheet.Rows))
	for i, row := range sheet.Rows {
		name := strings.TrimSpace(cell(row, m.Name))
		if name == "" {
			continue // строки без названия пропускаем
		}
		inStock, qty := parser.ParseStock(cell(row, m.Stock))
		currency := strings.TrimSpace(cell(row, m.Currency))
		if currency == "" {
			currency = "RUB"
		}
		offers = append(offers, &domain.SupplierOffer{
			BatchID:    batch.ID,
			SupplierID: supplierID,
			RowNum:     i + 1,
			RawName:    name,
			RawArticle: strings.TrimSpace(cell(row, m.Article)),
			Price:      parser.ParsePrice(cell(row, m.Price)),
			Currency:   currency,
			InStock:    inStock,
			StockQty:   qty,
		})
	}
	return offers
}

func (s *ImportService) GetBatch(ctx context.Context, id string) (*domain.ImportBatch, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.batches.GetByID(ctx, id)
}

func (s *ImportService) ListBatches(ctx context.Context, supplierID string) ([]*domain.ImportBatch, error) {
	return s.batches.ListBySupplier(ctx, strings.TrimSpace(supplierID))
}

func (s *ImportService) ListOffers(ctx context.Context, batchID string, limit, offset int) ([]*domain.SupplierOffer, int, error) {
	if strings.TrimSpace(batchID) == "" {
		return nil, 0, fmt.Errorf("%w: batch_id is required", domain.ErrValidation)
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return s.offers.ListOffers(ctx, batchID, limit, offset)
}

// cell безопасно берёт значение колонки по индексу (idx<0 или вне диапазона -> "").
func cell(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return row[idx]
}

// suggestMapping — эвристика по названиям колонок.
func suggestMapping(headers []string) domain.ColumnMapping {
	m := domain.ColumnMapping{Name: -1, Article: -1, Price: -1, Stock: -1, Currency: -1}
	for i, h := range headers {
		h = strings.ToLower(strings.TrimSpace(h))
		switch {
		case m.Name < 0 && containsAny(h, "наимен", "назван", "товар", "product", "name"):
			m.Name = i
		case m.Article < 0 && containsAny(h, "артикул", "код", "sku", "art", "article"):
			m.Article = i
		case m.Price < 0 && containsAny(h, "цена", "стоим", "price", "розниц", "опт"):
			m.Price = i
		case m.Stock < 0 && containsAny(h, "остаток", "наличи", "кол-во", "колич", "склад", "stock", "qty"):
			m.Stock = i
		case m.Currency < 0 && containsAny(h, "валют", "currency"):
			m.Currency = i
		}
	}
	return m
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
