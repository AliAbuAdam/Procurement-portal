// Package api — транспортный слой catalog (gRPC). Мапит proto<->domain
// и доменные ошибки в коды gRPC. Бизнес-логики здесь нет.
package api

import (
	"context"
	"errors"

	catalogv1 "github.com/furnica/backend/gen/catalog/v1"
	"github.com/furnica/backend/services/catalog/internal/domain"
	"github.com/furnica/backend/services/catalog/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type CatalogServer struct {
	catalogv1.UnimplementedCatalogServiceServer
	suppliers *service.SupplierService
	matching  *service.MatchingService
}

func NewCatalogServer(suppliers *service.SupplierService, matching *service.MatchingService) *CatalogServer {
	return &CatalogServer{suppliers: suppliers, matching: matching}
}

func (s *CatalogServer) HealthCheck(context.Context, *catalogv1.HealthCheckRequest) (*catalogv1.HealthCheckResponse, error) {
	return &catalogv1.HealthCheckResponse{Status: "ok", Service: "catalog"}, nil
}

func (s *CatalogServer) CreateSupplier(ctx context.Context, req *catalogv1.CreateSupplierRequest) (*catalogv1.Supplier, error) {
	sup, err := s.suppliers.Create(ctx, req.GetName(), typeFromProto(req.GetType()))
	if err != nil {
		return nil, toStatus(err)
	}
	return toProto(sup), nil
}

func (s *CatalogServer) ListSuppliers(ctx context.Context, req *catalogv1.ListSuppliersRequest) (*catalogv1.ListSuppliersResponse, error) {
	list, err := s.suppliers.List(ctx, int(req.GetPageSize()), 0)
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*catalogv1.Supplier, 0, len(list))
	for _, sup := range list {
		out = append(out, toProto(sup))
	}
	return &catalogv1.ListSuppliersResponse{Suppliers: out}, nil
}

// --- номенклатура (products) ---

func (s *CatalogServer) CreateProduct(ctx context.Context, req *catalogv1.CreateProductRequest) (*catalogv1.Product, error) {
	p, err := s.matching.CreateProduct(ctx, req.GetName(), req.GetArticle())
	if err != nil {
		return nil, toStatus(err)
	}
	return productToProto(p), nil
}

func (s *CatalogServer) ListProducts(ctx context.Context, req *catalogv1.ListProductsRequest) (*catalogv1.ListProductsResponse, error) {
	list, err := s.matching.ListProducts(ctx, req.GetQuery(), int(req.GetPageSize()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*catalogv1.Product, 0, len(list))
	for _, p := range list {
		out = append(out, productToProto(p))
	}
	return &catalogv1.ListProductsResponse{Products: out}, nil
}

// --- сопоставление (matching) ---

func (s *CatalogServer) SuggestMatches(ctx context.Context, req *catalogv1.SuggestMatchesRequest) (*catalogv1.SuggestMatchesResponse, error) {
	suggestions, err := s.matching.Suggest(ctx, req.GetOfferIds(), int(req.GetLimit()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*catalogv1.OfferSuggestion, 0, len(suggestions))
	for _, sg := range suggestions {
		cands := make([]*catalogv1.Candidate, 0, len(sg.Candidates))
		for _, c := range sg.Candidates {
			cands = append(cands, &catalogv1.Candidate{
				ProductId:      c.ProductID,
				ProductName:    c.ProductName,
				ProductArticle: c.ProductArticle,
				Score:          c.Score,
			})
		}
		out = append(out, &catalogv1.OfferSuggestion{
			OfferId:    sg.OfferID,
			RawName:    sg.RawName,
			RawArticle: sg.RawArticle,
			Candidates: cands,
		})
	}
	return &catalogv1.SuggestMatchesResponse{Suggestions: out}, nil
}

func (s *CatalogServer) ListUnmatchedOffers(ctx context.Context, req *catalogv1.ListUnmatchedOffersRequest) (*catalogv1.ListUnmatchedOffersResponse, error) {
	offers, total, matched, err := s.matching.ListUnmatched(ctx, req.GetBatchId(), int(req.GetPageSize()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*catalogv1.UnmatchedOffer, 0, len(offers))
	for _, o := range offers {
		out = append(out, &catalogv1.UnmatchedOffer{
			OfferId:    o.ID,
			RowNum:     int32(o.RowNum),
			RawName:    o.RawName,
			RawArticle: o.RawArticle,
			Price:      o.Price,
			Currency:   o.Currency,
		})
	}
	return &catalogv1.ListUnmatchedOffersResponse{
		Offers:  out,
		Total:   int32(total),
		Matched: int32(matched),
	}, nil
}

func (s *CatalogServer) ConfirmMatch(ctx context.Context, req *catalogv1.ConfirmMatchRequest) (*catalogv1.Match, error) {
	m, err := s.matching.ConfirmMatch(ctx, req.GetOfferId(), req.GetProductId(), req.GetMatchedBy())
	if err != nil {
		return nil, toStatus(err)
	}
	return matchToProto(m), nil
}

func (s *CatalogServer) CreateProductFromOffer(ctx context.Context, req *catalogv1.CreateProductFromOfferRequest) (*catalogv1.Match, error) {
	m, err := s.matching.CreateProductFromOffer(ctx, req.GetOfferId(), req.GetName(), req.GetArticle(), req.GetMatchedBy())
	if err != nil {
		return nil, toStatus(err)
	}
	return matchToProto(m), nil
}

func (s *CatalogServer) Unmatch(ctx context.Context, req *catalogv1.UnmatchRequest) (*catalogv1.UnmatchResponse, error) {
	if err := s.matching.Unmatch(ctx, req.GetOfferId()); err != nil {
		return nil, toStatus(err)
	}
	return &catalogv1.UnmatchResponse{Ok: true}, nil
}

// --- маппинг ---

func productToProto(p *domain.Product) *catalogv1.Product {
	return &catalogv1.Product{
		Id:        p.ID,
		Name:      p.Name,
		Article:   p.Article,
		CreatedAt: p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func matchToProto(m *domain.Match) *catalogv1.Match {
	return &catalogv1.Match{
		OfferId:   m.OfferID,
		ProductId: m.ProductID,
		Score:     m.Score,
		MatchedBy: m.MatchedBy,
		MatchedAt: m.MatchedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func toProto(s *domain.Supplier) *catalogv1.Supplier {
	return &catalogv1.Supplier{
		Id:        s.ID,
		Name:      s.Name,
		Type:      typeToProto(s.Type),
		CreatedAt: s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func typeFromProto(t catalogv1.SupplierType) domain.SupplierType {
	switch t {
	case catalogv1.SupplierType_SUPPLIER_TYPE_EXCEL:
		return domain.SupplierTypeExcel
	case catalogv1.SupplierType_SUPPLIER_TYPE_API:
		return domain.SupplierTypeAPI
	case catalogv1.SupplierType_SUPPLIER_TYPE_PARSING:
		return domain.SupplierTypeParsing
	default:
		return domain.SupplierTypeUnspecified
	}
}

func typeToProto(t domain.SupplierType) catalogv1.SupplierType {
	switch t {
	case domain.SupplierTypeExcel:
		return catalogv1.SupplierType_SUPPLIER_TYPE_EXCEL
	case domain.SupplierTypeAPI:
		return catalogv1.SupplierType_SUPPLIER_TYPE_API
	case domain.SupplierTypeParsing:
		return catalogv1.SupplierType_SUPPLIER_TYPE_PARSING
	default:
		return catalogv1.SupplierType_SUPPLIER_TYPE_UNSPECIFIED
	}
}

func toStatus(err error) error {
	switch {
	case errors.Is(err, domain.ErrValidation):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, domain.ErrNotFound),
		errors.Is(err, domain.ErrProductNotFound),
		errors.Is(err, domain.ErrOfferNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, domain.ErrSupplierExists):
		return status.Error(codes.AlreadyExists, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
