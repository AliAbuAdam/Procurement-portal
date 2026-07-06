// Package service — бизнес-логика catalog.
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// MatchingService — карточки номенклатуры и сопоставление строк прайсов с ними.
type MatchingService struct {
	txm      *postgres.TxManager
	products domain.ProductRepository
	matches  domain.MatchRepository
}

func NewMatchingService(txm *postgres.TxManager, products domain.ProductRepository, matches domain.MatchRepository) *MatchingService {
	return &MatchingService{txm: txm, products: products, matches: matches}
}

const (
	defaultProductLimit   = 50
	maxProductLimit       = 200
	defaultCandidateLimit = 5
	maxCandidateLimit     = 20
	defaultUnmatchedLimit = 200
	maxUnmatchedLimit     = 500
	maxSuggestOffers      = 200
)

func (s *MatchingService) CreateProduct(ctx context.Context, name, article, imageURL string) (*domain.Product, error) {
	name = strings.TrimSpace(name)
	article = strings.TrimSpace(article)
	imageURL = strings.TrimSpace(imageURL)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	p := &domain.Product{Name: name, Article: article, ImageURL: imageURL}
	if err := s.products.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// ListProducts: с непустым query — триграммный поиск, иначе последние карточки.
func (s *MatchingService) ListProducts(ctx context.Context, query string, limit int) ([]*domain.Product, error) {
	limit = clamp(limit, defaultProductLimit, maxProductLimit)
	query = strings.TrimSpace(query)
	if query != "" {
		return s.products.Search(ctx, query, limit)
	}
	return s.products.List(ctx, limit)
}

func (s *MatchingService) Suggest(ctx context.Context, offerIDs []string, limit int) ([]*domain.OfferSuggestion, error) {
	ids := trimIDs(offerIDs)
	if len(ids) == 0 {
		return nil, fmt.Errorf("%w: offer_ids is required", domain.ErrValidation)
	}
	if len(ids) > maxSuggestOffers {
		return nil, fmt.Errorf("%w: too many offer_ids (max %d)", domain.ErrValidation, maxSuggestOffers)
	}
	limit = clamp(limit, defaultCandidateLimit, maxCandidateLimit)
	return s.matches.Suggest(ctx, ids, limit)
}

func (s *MatchingService) ListUnmatched(ctx context.Context, batchID string, limit int) ([]*domain.RawOffer, int, int, error) {
	batchID = strings.TrimSpace(batchID)
	if batchID == "" {
		return nil, 0, 0, fmt.Errorf("%w: batch_id is required", domain.ErrValidation)
	}
	limit = clamp(limit, defaultUnmatchedLimit, maxUnmatchedLimit)
	return s.matches.ListUnmatched(ctx, batchID, limit)
}

func (s *MatchingService) ConfirmMatch(ctx context.Context, offerID, productID, matchedBy string) (*domain.Match, error) {
	offerID = strings.TrimSpace(offerID)
	productID = strings.TrimSpace(productID)
	if offerID == "" || productID == "" {
		return nil, fmt.Errorf("%w: offer_id and product_id are required", domain.ErrValidation)
	}
	return s.matches.Upsert(ctx, offerID, productID, matchedBy)
}

// CreateProductFromOffer создаёт карточку из строки прайса и сразу её подтверждает
// (путь «ни один кандидат не подошёл»). Обе операции — в одной транзакции.
func (s *MatchingService) CreateProductFromOffer(ctx context.Context, offerID, name, article, matchedBy string) (*domain.Match, error) {
	offerID = strings.TrimSpace(offerID)
	if offerID == "" {
		return nil, fmt.Errorf("%w: offer_id is required", domain.ErrValidation)
	}
	name = strings.TrimSpace(name)
	article = strings.TrimSpace(article)

	var match *domain.Match
	err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
		offer, err := s.matches.GetOffer(ctx, offerID)
		if err != nil {
			return err
		}
		if name == "" {
			name = strings.TrimSpace(offer.RawName)
		}
		if name == "" {
			return fmt.Errorf("%w: name is empty and offer has no raw_name", domain.ErrValidation)
		}
		if article == "" {
			article = strings.TrimSpace(offer.RawArticle)
		}
		p := &domain.Product{Name: name, Article: article}
		if err := s.products.Create(ctx, p); err != nil {
			return err
		}
		match, err = s.matches.Upsert(ctx, offerID, p.ID, matchedBy)
		return err
	})
	if err != nil {
		return nil, err
	}
	return match, nil
}

func (s *MatchingService) Unmatch(ctx context.Context, offerID string) error {
	offerID = strings.TrimSpace(offerID)
	if offerID == "" {
		return fmt.Errorf("%w: offer_id is required", domain.ErrValidation)
	}
	return s.matches.Delete(ctx, offerID)
}

func clamp(v, def, max int) int {
	if v <= 0 {
		return def
	}
	if v > max {
		return max
	}
	return v
}

func trimIDs(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" {
			out = append(out, id)
		}
	}
	return out
}
