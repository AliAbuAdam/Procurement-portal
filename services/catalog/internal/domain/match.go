package domain

import (
	"context"
	"errors"
	"time"
)

// ErrOfferNotFound — сырая строка прайса не найдена.
var ErrOfferNotFound = errors.New("offer not found")

// Match — подтверждённая связка «строка прайса -> карточка».
type Match struct {
	OfferID   string
	ProductID string
	Score     float32
	MatchedBy string
	MatchedAt time.Time
}

// Candidate — карточка-кандидат для строки и её похожесть (0..1).
type Candidate struct {
	ProductID      string
	ProductName    string
	ProductArticle string
	Score          float32
}

// OfferSuggestion — сырая строка и подобранные под неё карточки-кандидаты.
type OfferSuggestion struct {
	OfferID    string
	RawName    string
	RawArticle string
	Candidates []*Candidate
}

// RawOffer — сырая строка прайса (read-only проекция importer.supplier_offers).
// Catalog читает её для сопоставления; писать в importer нельзя.
type RawOffer struct {
	ID         string
	RowNum     int
	RawName    string
	RawArticle string
	Price      float64
	Currency   string
}

// MatchRepository — сопоставление. Часть запросов читает схему importer
// (supplier_offers) — осознанный cross-schema read в рамках одной БД.
type MatchRepository interface {
	// Upsert подтверждает связку и вычисляет score = similarity(product.name,
	// offer.raw_name) прямо в БД. Если строки или карточки нет — ErrOfferNotFound.
	Upsert(ctx context.Context, offerID, productID, matchedBy string) (*Match, error)
	Delete(ctx context.Context, offerID string) error
	// GetOffer читает сырую строку прайса (для создания карточки из строки).
	GetOffer(ctx context.Context, offerID string) (*RawOffer, error)
	// Suggest для каждой строки возвращает топ-N карточек-кандидатов по similarity.
	Suggest(ctx context.Context, offerIDs []string, limit int) ([]*OfferSuggestion, error)
	// ListUnmatched возвращает несопоставленные строки батча и счётчики прогресса.
	ListUnmatched(ctx context.Context, batchID string, limit int) (offers []*RawOffer, total, matched int, err error)
}
