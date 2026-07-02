package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/jackc/pgx/v5"
)

type MatchRepository struct {
	db *postgres.TxManager
}

func NewMatchRepository(db *postgres.TxManager) *MatchRepository {
	return &MatchRepository{db: db}
}

// Upsert подтверждает связку offer->product. score считается в самой БД как
// similarity(product.name, offer.raw_name). Если карточки или строки нет, SELECT
// не вернёт строк -> INSERT ничего не вставит -> ErrNoRows -> ErrOfferNotFound.
func (r *MatchRepository) Upsert(ctx context.Context, offerID, productID, matchedBy string) (*domain.Match, error) {
	const q = `
		INSERT INTO catalog.offer_matches (offer_id, product_id, score, matched_by)
		SELECT o.id, p.id, COALESCE(similarity(p.name, o.raw_name), 0), $3
		FROM catalog.products p
		JOIN importer.supplier_offers o ON o.id = $1
		WHERE p.id = $2
		ON CONFLICT (offer_id) DO UPDATE
		    SET product_id = EXCLUDED.product_id,
		        score      = EXCLUDED.score,
		        matched_by = EXCLUDED.matched_by,
		        matched_at = now()
		RETURNING offer_id, product_id, score, matched_by, matched_at`
	var m domain.Match
	err := r.db.Querier(ctx).QueryRow(ctx, q, offerID, productID, matchedBy).
		Scan(&m.OfferID, &m.ProductID, &m.Score, &m.MatchedBy, &m.MatchedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrOfferNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("upsert match: %w", err)
	}
	return &m, nil
}

func (r *MatchRepository) Delete(ctx context.Context, offerID string) error {
	const q = `DELETE FROM catalog.offer_matches WHERE offer_id = $1`
	tag, err := r.db.Querier(ctx).Exec(ctx, q, offerID)
	if err != nil {
		return fmt.Errorf("delete match: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrOfferNotFound
	}
	return nil
}

// GetOffer читает сырую строку прайса из схемы importer (read-only).
func (r *MatchRepository) GetOffer(ctx context.Context, offerID string) (*domain.RawOffer, error) {
	const q = `
		SELECT id, row_num, raw_name, raw_article, price, currency
		FROM importer.supplier_offers
		WHERE id = $1`
	var o domain.RawOffer
	err := r.db.Querier(ctx).QueryRow(ctx, q, offerID).
		Scan(&o.ID, &o.RowNum, &o.RawName, &o.RawArticle, &o.Price, &o.Currency)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrOfferNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get offer: %w", err)
	}
	return &o, nil
}

// Suggest для каждой строки берёт топ-N похожих карточек (pg_trgm, LATERAL).
// Строки без кандидатов возвращаются с пустым списком (LEFT JOIN).
func (r *MatchRepository) Suggest(ctx context.Context, offerIDs []string, limit int) ([]*domain.OfferSuggestion, error) {
	const q = `
		SELECT o.id, o.raw_name, o.raw_article,
		       c.id, c.name, c.article, c.score
		FROM importer.supplier_offers o
		LEFT JOIN LATERAL (
		    SELECT p.id, p.name, p.article, similarity(p.name, o.raw_name) AS score
		    FROM catalog.products p
		    WHERE p.name % o.raw_name
		    ORDER BY score DESC
		    LIMIT $2
		) c ON true
		WHERE o.id::text = ANY($1)
		ORDER BY o.row_num, c.score DESC NULLS LAST`
	rows, err := r.db.Querier(ctx).Query(ctx, q, offerIDs, limit)
	if err != nil {
		return nil, fmt.Errorf("suggest matches: %w", err)
	}
	defer rows.Close()

	// Группируем плоский результат по строке, сохраняя порядок появления.
	order := make([]string, 0)
	byOffer := make(map[string]*domain.OfferSuggestion)
	for rows.Next() {
		var (
			offerID, rawName, rawArticle string
			pID, pName, pArticle         *string
			score                        *float32
		)
		if err := rows.Scan(&offerID, &rawName, &rawArticle, &pID, &pName, &pArticle, &score); err != nil {
			return nil, fmt.Errorf("scan suggestion: %w", err)
		}
		s, ok := byOffer[offerID]
		if !ok {
			s = &domain.OfferSuggestion{OfferID: offerID, RawName: rawName, RawArticle: rawArticle}
			byOffer[offerID] = s
			order = append(order, offerID)
		}
		if pID != nil { // строка без кандидатов даёт NULL-колонки
			c := &domain.Candidate{ProductID: *pID, ProductName: deref(pName), ProductArticle: deref(pArticle)}
			if score != nil {
				c.Score = *score
			}
			s.Candidates = append(s.Candidates, c)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]*domain.OfferSuggestion, 0, len(order))
	for _, id := range order {
		out = append(out, byOffer[id])
	}
	return out, nil
}

// ListUnmatched: строки батча без подтверждённого сопоставления + счётчики.
func (r *MatchRepository) ListUnmatched(ctx context.Context, batchID string, limit int) ([]*domain.RawOffer, int, int, error) {
	const listQ = `
		SELECT o.id, o.row_num, o.raw_name, o.raw_article, o.price, o.currency
		FROM importer.supplier_offers o
		LEFT JOIN catalog.offer_matches m ON m.offer_id = o.id
		WHERE o.batch_id = $1 AND m.offer_id IS NULL
		ORDER BY o.row_num
		LIMIT $2`
	rows, err := r.db.Querier(ctx).Query(ctx, listQ, batchID, limit)
	if err != nil {
		return nil, 0, 0, fmt.Errorf("list unmatched: %w", err)
	}
	defer rows.Close()

	var offers []*domain.RawOffer
	for rows.Next() {
		var o domain.RawOffer
		if err := rows.Scan(&o.ID, &o.RowNum, &o.RawName, &o.RawArticle, &o.Price, &o.Currency); err != nil {
			return nil, 0, 0, fmt.Errorf("scan unmatched: %w", err)
		}
		offers = append(offers, &o)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, 0, err
	}

	const countQ = `
		SELECT COUNT(*) AS total, COUNT(m.offer_id) AS matched
		FROM importer.supplier_offers o
		LEFT JOIN catalog.offer_matches m ON m.offer_id = o.id
		WHERE o.batch_id = $1`
	var total, matched int
	if err := r.db.Querier(ctx).QueryRow(ctx, countQ, batchID).Scan(&total, &matched); err != nil {
		return nil, 0, 0, fmt.Errorf("count matched: %w", err)
	}
	return offers, total, matched, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
