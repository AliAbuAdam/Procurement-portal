// Package service — бизнес-логика catalog.
package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/furnica/backend/internal/postgres"
	"github.com/furnica/backend/services/catalog/internal/domain"
)

// MatchingService — карточки номенклатуры, их фото и сопоставление строк прайсов.
type MatchingService struct {
	txm        *postgres.TxManager
	products   domain.ProductRepository
	matches    domain.MatchRepository
	images     domain.ProductImageRepository
	categories domain.CategoryRepository // для автокатегории по привязкам поставщика
}

func NewMatchingService(txm *postgres.TxManager, products domain.ProductRepository, matches domain.MatchRepository, images domain.ProductImageRepository, categories domain.CategoryRepository) *MatchingService {
	return &MatchingService{txm: txm, products: products, matches: matches, images: images, categories: categories}
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

func (s *MatchingService) CreateProduct(ctx context.Context, name, article, imageURL, categoryID string) (*domain.Product, error) {
	name = strings.TrimSpace(name)
	article = strings.TrimSpace(article)
	imageURL = strings.TrimSpace(imageURL)
	if name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	p := &domain.Product{Name: name, Article: article, ImageURL: imageURL, CategoryID: strings.TrimSpace(categoryID)}
	if err := s.products.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// ListProducts: с непустым query — триграммный поиск, иначе последние карточки.
// Непустой categoryID сужает выборку категорией и её подкатегориями.
func (s *MatchingService) ListProducts(ctx context.Context, query, categoryID string, limit int) ([]*domain.Product, error) {
	limit = clamp(limit, defaultProductLimit, maxProductLimit)
	query = strings.TrimSpace(query)
	categoryID = strings.TrimSpace(categoryID)
	if query != "" {
		return s.products.Search(ctx, query, categoryID, limit)
	}
	return s.products.List(ctx, categoryID, limit)
}

func (s *MatchingService) GetProduct(ctx context.Context, id string) (*domain.Product, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.products.GetByID(ctx, id)
}

// SetProductCategory — массовое назначение категории (categoryID "" — снять).
func (s *MatchingService) SetProductCategory(ctx context.Context, ids []string, categoryID string) (int, error) {
	ids = trimIDs(ids)
	if len(ids) == 0 {
		return 0, fmt.Errorf("%w: product_ids is required", domain.ErrValidation)
	}
	return s.products.SetCategory(ctx, ids, strings.TrimSpace(categoryID))
}

// --- фото карточки (галерея) ---

const (
	maxImageBytes = 3 << 20  // 3 МиБ на сжатое фото — с запасом к клиентскому ресайзу
	maxThumbBytes = 512 << 10
)

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

func (s *MatchingService) ListProductImages(ctx context.Context, productID string) ([]*domain.ProductImage, error) {
	productID = strings.TrimSpace(productID)
	if productID == "" {
		return nil, fmt.Errorf("%w: product_id is required", domain.ErrValidation)
	}
	return s.images.ListByProduct(ctx, productID)
}

func (s *MatchingService) AddProductImage(ctx context.Context, productID, contentType string, data, thumb []byte) (*domain.ProductImage, error) {
	productID = strings.TrimSpace(productID)
	if productID == "" {
		return nil, fmt.Errorf("%w: product_id is required", domain.ErrValidation)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("%w: пустой файл фото", domain.ErrValidation)
	}
	if len(data) > maxImageBytes || len(thumb) > maxThumbBytes {
		return nil, fmt.Errorf("%w: фото слишком большое (максимум %d МБ)", domain.ErrValidation, maxImageBytes>>20)
	}
	if !allowedImageTypes[contentType] {
		return nil, fmt.Errorf("%w: поддерживаются только JPEG, PNG и WebP", domain.ErrValidation)
	}

	img := &domain.ProductImage{ProductID: productID, ContentType: contentType, Data: data, Thumb: thumb}
	// Проверка лимита и вставка в одной транзакции, чтобы параллельные загрузки
	// не перепрыгнули лимит.
	err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
		if _, err := s.products.GetByID(ctx, productID); err != nil {
			return err
		}
		n, err := s.images.CountByProduct(ctx, productID)
		if err != nil {
			return err
		}
		if n >= domain.MaxImagesPerProduct {
			return fmt.Errorf("%w: у карточки уже %d фото (максимум)", domain.ErrValidation, domain.MaxImagesPerProduct)
		}
		return s.images.Insert(ctx, img)
	})
	if err != nil {
		return nil, err
	}
	return img, nil
}

func (s *MatchingService) DeleteProductImage(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.images.Delete(ctx, id)
}

func (s *MatchingService) ReorderProductImages(ctx context.Context, productID string, ids []string) ([]*domain.ProductImage, error) {
	productID = strings.TrimSpace(productID)
	ids = trimIDs(ids)
	if productID == "" || len(ids) == 0 {
		return nil, fmt.Errorf("%w: product_id and image_ids are required", domain.ErrValidation)
	}
	if err := s.images.Reorder(ctx, productID, ids); err != nil {
		return nil, err
	}
	return s.images.ListByProduct(ctx, productID)
}

func (s *MatchingService) GetProductImage(ctx context.Context, id string, thumb bool) (string, []byte, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", nil, fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	return s.images.GetData(ctx, id, thumb)
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
		// Автокатегория: если категория поставщика из этой строки привязана
		// к категории витрины — новая карточка сразу падает в неё.
		if offer.RawCategory != "" {
			catID, err := s.categories.MappedCategory(ctx, offer.SupplierID, offer.RawCategory)
			if err != nil {
				return err
			}
			p.CategoryID = catID
		}
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
