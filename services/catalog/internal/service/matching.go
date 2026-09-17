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
	store      domain.ImageStore         // S3 для байтов фото (nil — байты в Postgres)
}

func NewMatchingService(txm *postgres.TxManager, products domain.ProductRepository, matches domain.MatchRepository, images domain.ProductImageRepository, categories domain.CategoryRepository, store domain.ImageStore) *MatchingService {
	return &MatchingService{txm: txm, products: products, matches: matches, images: images, categories: categories, store: store}
}

// imageKeys — ключи объекта фото в S3. Плоская схема под общий префикс
// products/ (его целиком чистит админ-очистка данных).
func imageKeys(imageID string, hasThumb bool) (key, thumbKey string) {
	key = "products/" + imageID
	if hasThumb {
		thumbKey = key + "-thumb"
	}
	return key, thumbKey
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

// ListProducts: с непустым Query — триграммный поиск по имени и артикулу,
// иначе — сортировка из фильтра. Возвращает страницу и total для пагинации.
func (s *MatchingService) ListProducts(ctx context.Context, f domain.ProductFilter) ([]*domain.Product, int, error) {
	f.Limit = clamp(f.Limit, defaultProductLimit, maxProductLimit)
	if f.Offset < 0 {
		f.Offset = 0
	}
	f.Query = strings.TrimSpace(f.Query)
	f.CategoryID = strings.TrimSpace(f.CategoryID)
	f.SupplierID = strings.TrimSpace(f.SupplierID)
	switch f.Sort {
	case domain.SortNew, domain.SortName, domain.SortPriceAsc, domain.SortPriceDesc:
	case "new":
		f.Sort = domain.SortNew
	default:
		return nil, 0, fmt.Errorf("%w: unknown sort %q", domain.ErrValidation, f.Sort)
	}
	return s.products.List(ctx, f)
}

// Ограничения характеристик карточки — защита от случайной простыни из UI.
const (
	maxProductAttrs     = 50
	maxAttrLen          = 500
	maxDescriptionChars = 10000
)

// sanitizeAttrs чистит характеристики: трим, пустые имена — вон, лимиты.
func sanitizeAttrs(attrs []domain.ProductAttr) ([]domain.ProductAttr, error) {
	out := make([]domain.ProductAttr, 0, len(attrs))
	for _, a := range attrs {
		a.Name = strings.TrimSpace(a.Name)
		a.Value = strings.TrimSpace(a.Value)
		if a.Name == "" && a.Value == "" {
			continue
		}
		if a.Name == "" {
			return nil, fmt.Errorf("%w: у характеристики со значением %q нет названия", domain.ErrValidation, a.Value)
		}
		if len([]rune(a.Name)) > maxAttrLen || len([]rune(a.Value)) > maxAttrLen {
			return nil, fmt.Errorf("%w: характеристика слишком длинная (максимум %d символов)", domain.ErrValidation, maxAttrLen)
		}
		out = append(out, a)
	}
	if len(out) > maxProductAttrs {
		return nil, fmt.Errorf("%w: слишком много характеристик (максимум %d)", domain.ErrValidation, maxProductAttrs)
	}
	return out, nil
}

// UpdateProduct — полная замена редактируемых полей карточки.
func (s *MatchingService) UpdateProduct(ctx context.Context, p *domain.Product) (*domain.Product, error) {
	p.ID = strings.TrimSpace(p.ID)
	p.Name = strings.TrimSpace(p.Name)
	p.Article = strings.TrimSpace(p.Article)
	p.Description = strings.TrimSpace(p.Description)
	p.CategoryID = strings.TrimSpace(p.CategoryID)
	if p.ID == "" {
		return nil, fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	if p.Name == "" {
		return nil, fmt.Errorf("%w: name is required", domain.ErrValidation)
	}
	if len([]rune(p.Description)) > maxDescriptionChars {
		return nil, fmt.Errorf("%w: описание слишком длинное (максимум %d символов)", domain.ErrValidation, maxDescriptionChars)
	}
	attrs, err := sanitizeAttrs(p.Attrs)
	if err != nil {
		return nil, err
	}
	p.Attrs = attrs
	if err := s.products.Update(ctx, p); err != nil {
		return nil, err
	}
	// Перечитываем: created_at и cover_image_id знает только БД.
	return s.products.GetByID(ctx, p.ID)
}

// DeleteProduct удаляет карточку. Сопоставления и строки фото уходят каскадом
// в той же транзакции; объекты в S3 чистим после коммита, best-effort
// (сирота в хранилище безопасен, строка с ключом на удалённый объект — нет).
func (s *MatchingService) DeleteProduct(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("%w: id is required", domain.ErrValidation)
	}
	var keys []string
	err := s.txm.WithinTx(ctx, func(ctx context.Context) error {
		var err error
		if keys, err = s.images.S3KeysByProduct(ctx, id); err != nil {
			return err
		}
		return s.products.Delete(ctx, id)
	})
	if err != nil {
		return err
	}
	if s.store != nil && len(keys) > 0 {
		_ = s.store.Delete(ctx, keys...)
	}
	return nil
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
	// не перепрыгнули лимит. С настроенным S3 байты в Postgres не пишем:
	// строка вставляется пустой, объекты грузятся в S3, затем в строку
	// записываются ключи; сбой любой из стадий откатывает транзакцию целиком
	// (возможный объект-сирота в S3 перезапишется при повторной загрузке).
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
		if s.store == nil {
			return s.images.Insert(ctx, img)
		}
		dbImg := *img
		dbImg.Data, dbImg.Thumb = nil, nil
		if err := s.images.Insert(ctx, &dbImg); err != nil {
			return err
		}
		img.ID, img.Position, img.CreatedAt = dbImg.ID, dbImg.Position, dbImg.CreatedAt
		key, thumbKey := imageKeys(dbImg.ID, len(thumb) > 0)
		if err := s.store.Put(ctx, key, data, contentType); err != nil {
			return err
		}
		if thumbKey != "" {
			if err := s.store.Put(ctx, thumbKey, thumb, contentType); err != nil {
				return err
			}
		}
		img.S3Key, img.S3ThumbKey = key, thumbKey
		return s.images.SetS3Keys(ctx, dbImg.ID, key, thumbKey)
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
	key, thumbKey, err := s.images.Delete(ctx, id)
	if err != nil {
		return err
	}
	// Объекты в S3 чистим после удаления строки, best-effort.
	if s.store != nil && key != "" {
		_ = s.store.Delete(ctx, key, thumbKey)
	}
	return nil
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
	contentType, data, s3Key, err := s.images.GetData(ctx, id, thumb)
	if err != nil {
		return "", nil, err
	}
	if len(data) > 0 || s3Key == "" {
		return contentType, data, nil
	}
	if s.store == nil {
		return "", nil, fmt.Errorf("фото хранится в S3, но S3 не настроен (S3_ENDPOINT)")
	}
	data, err = s.store.Get(ctx, s3Key)
	if err != nil {
		return "", nil, err
	}
	return contentType, data, nil
}

// MigrateImagesToS3 переносит байты фото из Postgres в S3 (фоново на старте).
// Каждое фото — отдельная транзакция: сбой не откатывает уже перенесённое.
func (s *MatchingService) MigrateImagesToS3(ctx context.Context) (int, error) {
	if s.store == nil {
		return 0, nil
	}
	total := 0
	for {
		batch, err := s.images.ListUnmigrated(ctx, 20)
		if err != nil {
			return total, err
		}
		if len(batch) == 0 {
			return total, nil
		}
		for _, img := range batch {
			key, thumbKey := imageKeys(img.ID, len(img.Thumb) > 0)
			if err := s.store.Put(ctx, key, img.Data, img.ContentType); err != nil {
				return total, err
			}
			if thumbKey != "" {
				if err := s.store.Put(ctx, thumbKey, img.Thumb, img.ContentType); err != nil {
					return total, err
				}
			}
			if err := s.images.SetS3Keys(ctx, img.ID, key, thumbKey); err != nil {
				return total, err
			}
			total++
		}
	}
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

// Пороги автообработки. Выше autoMatchScore — привязываем к лучшему кандидату
// сами; ниже createBelowScore (или кандидатов нет) — уверенно новый товар,
// создаём карточку; между ними — серая зона, оставляем человеку.
const (
	autoMatchScore   = 0.7
	createBelowScore = 0.45
)

// AutoProcessResult — итог автообработки батча.
type AutoProcessResult struct {
	Matched int // автопривязано к существующим карточкам
	Created int // создано новых карточек
	Skipped int // серая зона — оставлено на ручной разбор
}

// AutoProcessBatch обходит несопоставленные строки батча по одной (свежесозданная
// карточка сразу становится кандидатом для следующих строк — дублей внутри
// прайса не будет). Каждая строка коммитится отдельно: сбой на середине не
// откатывает уже сделанное, остаток просто дообработается повторным запуском.
func (s *MatchingService) AutoProcessBatch(ctx context.Context, batchID, matchedBy string) (*AutoProcessResult, error) {
	batchID = strings.TrimSpace(batchID)
	if batchID == "" {
		return nil, fmt.Errorf("%w: batch_id is required", domain.ErrValidation)
	}

	res := &AutoProcessResult{}
	skipped := map[string]bool{} // серая зона: ListUnmatched вернёт их снова — не зацикливаемся
	for {
		offers, _, _, err := s.matches.ListUnmatched(ctx, batchID, maxUnmatchedLimit)
		if err != nil {
			return nil, err
		}
		progress := false
		for _, o := range offers {
			if skipped[o.ID] {
				continue
			}
			outcome, err := s.autoProcessOffer(ctx, o, matchedBy)
			if err != nil {
				return nil, err
			}
			switch outcome {
			case "matched":
				res.Matched++
				progress = true
			case "created":
				res.Created++
				progress = true
			default:
				skipped[o.ID] = true
			}
		}
		if !progress {
			break
		}
	}
	res.Skipped = len(skipped)
	return res, nil
}

// autoProcessOffer решает судьбу одной строки: "matched" | "created" | "skipped".
func (s *MatchingService) autoProcessOffer(ctx context.Context, o *domain.RawOffer, matchedBy string) (string, error) {
	// 1) Точный артикул — самый надёжный признак, побеждает похожесть имён.
	if art := strings.TrimSpace(o.RawArticle); art != "" {
		p, err := s.products.FindByArticle(ctx, art)
		if err != nil {
			return "", err
		}
		if p != nil {
			if _, err := s.matches.Upsert(ctx, o.ID, p.ID, matchedBy); err != nil {
				return "", err
			}
			return "matched", nil
		}
	}

	// 2) Похожесть названия: смотрим только лучшего кандидата.
	suggestions, err := s.matches.Suggest(ctx, []string{o.ID}, 1)
	if err != nil {
		return "", err
	}
	var best *domain.Candidate
	if len(suggestions) > 0 && len(suggestions[0].Candidates) > 0 {
		best = suggestions[0].Candidates[0]
	}

	switch {
	case best != nil && best.Score >= autoMatchScore:
		if _, err := s.matches.Upsert(ctx, o.ID, best.ProductID, matchedBy); err != nil {
			return "", err
		}
		return "matched", nil
	case best == nil || best.Score < createBelowScore:
		// Явно новый товар: карточка из строки (внутри — автокатегория по
		// привязкам поставщика) + подтверждение, той же транзакцией.
		if _, err := s.CreateProductFromOffer(ctx, o.ID, "", "", matchedBy); err != nil {
			return "", err
		}
		return "created", nil
	default:
		return "skipped", nil
	}
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
