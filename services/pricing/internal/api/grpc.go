// Package api — транспортный слой pricing (gRPC).
package api

import (
	"context"
	"errors"

	pricingv1 "github.com/furnica/backend/gen/pricing/v1"
	"github.com/furnica/backend/services/pricing/internal/domain"
	"github.com/furnica/backend/services/pricing/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type PricingServer struct {
	pricingv1.UnimplementedPricingServiceServer
	prices *service.PriceService
}

func NewPricingServer(prices *service.PriceService) *PricingServer {
	return &PricingServer{prices: prices}
}

func (s *PricingServer) HealthCheck(context.Context, *pricingv1.HealthCheckRequest) (*pricingv1.HealthCheckResponse, error) {
	return &pricingv1.HealthCheckResponse{Status: "ok", Service: "pricing"}, nil
}

func (s *PricingServer) CompareByProduct(ctx context.Context, req *pricingv1.CompareByProductRequest) (*pricingv1.CompareByProductResponse, error) {
	cmp, err := s.prices.CompareByProduct(ctx, req.GetProductId(), domain.PriceTier(req.GetPriceTier()))
	if err != nil {
		return nil, toStatus(err)
	}
	offers := make([]*pricingv1.PriceOffer, 0, len(cmp.Offers))
	for _, o := range cmp.Offers {
		offers = append(offers, &pricingv1.PriceOffer{
			SupplierId:   o.SupplierID,
			SupplierName: o.SupplierName,
			Price:        o.Price,
			Currency:     o.Currency,
			InStock:      o.InStock,
			StockQty:     o.StockQty,
			UpdatedAt:    o.UpdatedAt,
			PriceOpt:     o.PriceOpt,
			PriceBulk:    o.PriceBulk,
		})
	}
	return &pricingv1.CompareByProductResponse{
		ProductId:          cmp.ProductID,
		Offers:             offers,
		CheapestSupplierId: cmp.CheapestSupplierID,
	}, nil
}

func (s *PricingServer) MinPricesByProducts(ctx context.Context, req *pricingv1.MinPricesByProductsRequest) (*pricingv1.MinPricesByProductsResponse, error) {
	list, err := s.prices.MinPricesByProducts(ctx, req.GetProductIds())
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*pricingv1.ProductMinPrice, 0, len(list))
	for _, p := range list {
		out = append(out, &pricingv1.ProductMinPrice{
			ProductId:     p.ProductID,
			MinPrice:      p.MinPrice,
			Currency:      p.Currency,
			SupplierCount: int32(p.SupplierCount),
			InStock:       p.InStock,
		})
	}
	return &pricingv1.MinPricesByProductsResponse{Prices: out}, nil
}

func toStatus(err error) error {
	switch {
	case errors.Is(err, domain.ErrValidation):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, domain.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
