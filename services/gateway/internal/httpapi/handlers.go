package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"

	catalogv1 "github.com/furnica/backend/gen/catalog/v1"
	importv1 "github.com/furnica/backend/gen/import/v1"
	pricingv1 "github.com/furnica/backend/gen/pricing/v1"
	"github.com/furnica/backend/services/gateway/internal/auth"
	"github.com/furnica/backend/services/gateway/internal/clients"
	"github.com/furnica/backend/services/gateway/internal/kratosadmin"
	"github.com/go-chi/chi/v5"
)

const maxUploadBytes = 32 << 20 // 32 MiB

type Handler struct {
	c     *clients.Clients
	admin *kratosadmin.Client
}

func NewHandler(c *clients.Clients, admin *kratosadmin.Client) *Handler {
	return &Handler{c: c, admin: admin}
}

// --- suppliers (catalog) ---

func (h *Handler) ListSuppliers(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.ListSuppliers(r.Context(), &catalogv1.ListSuppliersRequest{PageSize: 100})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateSupplier(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		City    string `json:"city"`
		Address string `json:"address"`
		Logo    string `json:"logo"`
		Status  string `json:"status"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.CreateSupplier(r.Context(), &catalogv1.CreateSupplierRequest{
		Name:    body.Name,
		Type:    supplierTypeFromString(body.Type),
		City:    body.City,
		Address: body.Address,
		Logo:    body.Logo,
		Status:  body.Status,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) UpdateSupplier(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		City    string `json:"city"`
		Address string `json:"address"`
		Logo    string `json:"logo"`
		Status  string `json:"status"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.UpdateSupplier(r.Context(), &catalogv1.UpdateSupplierRequest{
		Id:      chi.URLParam(r, "id"),
		Name:    body.Name,
		Type:    supplierTypeFromString(body.Type),
		City:    body.City,
		Address: body.Address,
		Logo:    body.Logo,
		Status:  body.Status,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) DeleteSupplier(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.DeleteSupplier(r.Context(), &catalogv1.DeleteSupplierRequest{
		Id: chi.URLParam(r, "id"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func supplierTypeFromString(s string) catalogv1.SupplierType {
	switch s {
	case "excel":
		return catalogv1.SupplierType_SUPPLIER_TYPE_EXCEL
	case "api":
		return catalogv1.SupplierType_SUPPLIER_TYPE_API
	case "parsing":
		return catalogv1.SupplierType_SUPPLIER_TYPE_PARSING
	default:
		return catalogv1.SupplierType_SUPPLIER_TYPE_UNSPECIFIED
	}
}

// --- products & matching (catalog) ---

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.ListProducts(r.Context(), &catalogv1.ListProductsRequest{
		Query:      r.URL.Query().Get("q"),
		CategoryId: r.URL.Query().Get("category"),
		PageSize:   200,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.GetProduct(r.Context(), &catalogv1.GetProductRequest{
		Id: chi.URLParam(r, "id"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// SetProductCategory — массовое назначение категории карточкам
// (category_id "" — снять категорию).
func (h *Handler) SetProductCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductIDs []string `json:"product_ids"`
		CategoryID string   `json:"category_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.SetProductCategory(r.Context(), &catalogv1.SetProductCategoryRequest{
		ProductIds: body.ProductIDs,
		CategoryId: body.CategoryID,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// --- категории витрины ---

func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.ListCategories(r.Context(), &catalogv1.ListCategoriesRequest{})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		ParentID string `json:"parent_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.CreateCategory(r.Context(), &catalogv1.CreateCategoryRequest{
		Name:     body.Name,
		ParentId: body.ParentID,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		ParentID string `json:"parent_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.UpdateCategory(r.Context(), &catalogv1.UpdateCategoryRequest{
		Id:       chi.URLParam(r, "id"),
		Name:     body.Name,
		ParentId: body.ParentID,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.DeleteCategory(r.Context(), &catalogv1.DeleteCategoryRequest{
		Id: chi.URLParam(r, "id"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Article  string `json:"article"`
		ImageURL string `json:"image_url"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.CreateProduct(r.Context(), &catalogv1.CreateProductRequest{
		Name:     body.Name,
		Article:  body.Article,
		ImageUrl: body.ImageURL,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

// --- фото карточки (галерея) ---

func (h *Handler) ListProductImages(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.ListProductImages(r.Context(), &catalogv1.ListProductImagesRequest{
		ProductId: chi.URLParam(r, "id"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// AddProductImage принимает JSON с base64 (фото уже сжато на клиенте).
func (h *Handler) AddProductImage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ContentType string `json:"content_type"`
		Data        string `json:"data_base64"`
		Thumb       string `json:"thumb_base64"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	data, err := base64.StdEncoding.DecodeString(body.Data)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid data_base64"})
		return
	}
	thumb, err := base64.StdEncoding.DecodeString(body.Thumb)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid thumb_base64"})
		return
	}
	resp, err := h.c.Catalog.AddProductImage(r.Context(), &catalogv1.AddProductImageRequest{
		ProductId:   chi.URLParam(r, "id"),
		ContentType: body.ContentType,
		Data:        data,
		Thumb:       thumb,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) DeleteProductImage(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.DeleteProductImage(r.Context(), &catalogv1.DeleteProductImageRequest{
		Id: chi.URLParam(r, "imageID"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ReorderProductImages(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ImageIDs []string `json:"image_ids"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.ReorderProductImages(r.Context(), &catalogv1.ReorderProductImagesRequest{
		ProductId: chi.URLParam(r, "id"),
		ImageIds:  body.ImageIDs,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// GetImage отдаёт бинарное содержимое фото (или миниатюру ?thumb=1).
// Содержимое фото по id неизменно, поэтому кэшируем в браузере надолго.
func (h *Handler) GetImage(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.GetProductImage(r.Context(), &catalogv1.GetProductImageRequest{
		Id:    chi.URLParam(r, "imageID"),
		Thumb: r.URL.Query().Get("thumb") == "1",
	})
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Content-Type", resp.GetContentType())
	w.Header().Set("Cache-Control", "private, max-age=604800, immutable")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(resp.GetData())
}

func (h *Handler) ListUnmatchedOffers(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.ListUnmatchedOffers(r.Context(), &catalogv1.ListUnmatchedOffersRequest{
		BatchId:  chi.URLParam(r, "id"),
		PageSize: 200,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) SuggestMatches(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferIDs []string `json:"offer_ids"`
		Limit    int32    `json:"limit"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.SuggestMatches(r.Context(), &catalogv1.SuggestMatchesRequest{
		OfferIds: body.OfferIDs,
		Limit:    body.Limit,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ConfirmMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferID   string `json:"offer_id"`
		ProductID string `json:"product_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.ConfirmMatch(r.Context(), &catalogv1.ConfirmMatchRequest{
		OfferId:   body.OfferID,
		ProductId: body.ProductID,
		MatchedBy: actorEmail(r),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) CreateProductFromOffer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OfferID string `json:"offer_id"`
		Name    string `json:"name"`
		Article string `json:"article"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Catalog.CreateProductFromOffer(r.Context(), &catalogv1.CreateProductFromOfferRequest{
		OfferId:   body.OfferID,
		Name:      body.Name,
		Article:   body.Article,
		MatchedBy: actorEmail(r),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) Unmatch(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Catalog.Unmatch(r.Context(), &catalogv1.UnmatchRequest{
		OfferId: chi.URLParam(r, "offerID"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// actorEmail — email текущего пользователя из сессии (для matched_by и т.п.).
func actorEmail(r *http.Request) string {
	if p, ok := auth.FromContext(r.Context()); ok {
		return p.Email
	}
	return ""
}

// --- prices (pricing) ---

func (h *Handler) CompareByProduct(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "productID")
	resp, err := h.c.Pricing.CompareByProduct(r.Context(), &pricingv1.CompareByProductRequest{
		ProductId: productID,
		PriceTier: r.URL.Query().Get("tier"), // base (по умолчанию) | opt | bulk
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// MinPrices — сводки «от X ₽» для карточек витрины по списку товаров.
func (h *Handler) MinPrices(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProductIDs []string `json:"product_ids"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	resp, err := h.c.Pricing.MinPricesByProducts(r.Context(), &pricingv1.MinPricesByProductsRequest{
		ProductIds: body.ProductIDs,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// --- imports (import) ---

// clientMapping — маппинг колонок из формы (индексы 0-based, -1 = не задано).
type clientMapping struct {
	NameCol      int32 `json:"name_col"`
	ArticleCol   int32 `json:"article_col"`
	PriceCol     int32 `json:"price_col"`
	StockCol     int32 `json:"stock_col"`
	CurrencyCol  int32 `json:"currency_col"`
	PriceOptCol  int32 `json:"price_opt_col"`
	PriceBulkCol int32 `json:"price_bulk_col"`
}

func (m clientMapping) toProto() *importv1.ColumnMapping {
	return &importv1.ColumnMapping{
		NameCol:      m.NameCol,
		ArticleCol:   m.ArticleCol,
		PriceCol:     m.PriceCol,
		StockCol:     m.StockCol,
		CurrencyCol:  m.CurrencyCol,
		PriceOptCol:  m.PriceOptCol,
		PriceBulkCol: m.PriceBulkCol,
	}
}

// PreviewImport: multipart (file) -> заголовки + первые строки + авто-маппинг.
func (h *Handler) PreviewImport(w http.ResponseWriter, r *http.Request) {
	name, content, ok := readUpload(w, r)
	if !ok {
		return
	}
	resp, err := h.c.Import.PreviewFile(r.Context(), &importv1.PreviewFileRequest{
		FileName: name,
		Content:  content,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateImport: multipart (file, supplier_id, mapping) -> разбор и сохранение.
func (h *Handler) CreateImport(w http.ResponseWriter, r *http.Request) {
	name, content, ok := readUpload(w, r)
	if !ok {
		return
	}
	// Новые опциональные колонки по умолчанию «не заданы» (-1): старый клиент,
	// не знающий про них, не должен случайно замапить их на колонку 0.
	m := clientMapping{PriceOptCol: -1, PriceBulkCol: -1}
	if raw := r.FormValue("mapping"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &m); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid mapping json"})
			return
		}
	}
	createdBy := ""
	if p, ok := auth.FromContext(r.Context()); ok {
		createdBy = p.Email
	}
	resp, err := h.c.Import.ProcessFile(r.Context(), &importv1.ProcessFileRequest{
		SupplierId: r.FormValue("supplier_id"),
		FileName:   name,
		Content:    content,
		Mapping:    m.toProto(),
		CreatedBy:  createdBy,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) ListImports(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Import.ListBatches(r.Context(), &importv1.ListBatchesRequest{
		SupplierId: r.URL.Query().Get("supplier_id"),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetImport(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Import.GetImportBatch(r.Context(), &importv1.GetImportBatchRequest{Id: chi.URLParam(r, "id")})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListImportOffers(w http.ResponseWriter, r *http.Request) {
	resp, err := h.c.Import.ListOffers(r.Context(), &importv1.ListOffersRequest{
		BatchId:  chi.URLParam(r, "id"),
		PageSize: 200,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// readUpload читает файл из multipart-формы (поле "file").
func readUpload(w http.ResponseWriter, r *http.Request) (string, []byte, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "файл слишком большой или форма некорректна"})
		return "", nil, false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "файл не приложен (поле file)"})
		return "", nil, false
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "не удалось прочитать файл"})
		return "", nil, false
	}
	return header.Filename, content, true
}

// --- me ---

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	p, ok := auth.FromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthenticated"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"id":    p.ID,
		"email": p.Email,
		"role":  string(p.Role),
	})
}
