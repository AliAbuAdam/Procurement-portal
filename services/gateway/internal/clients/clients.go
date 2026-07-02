// Package clients — gRPC-клиенты к внутренним сервисам.
// Наружу gateway отдаёт REST, внутрь ходит по gRPC.
package clients

import (
	catalogv1 "github.com/furnica/backend/gen/catalog/v1"
	importv1 "github.com/furnica/backend/gen/import/v1"
	pricingv1 "github.com/furnica/backend/gen/pricing/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Clients struct {
	Catalog catalogv1.CatalogServiceClient
	Pricing pricingv1.PricingServiceClient
	Import  importv1.ImportServiceClient

	conns []*grpc.ClientConn
}

// New открывает соединения к сервисам по адресам (host:port).
func New(catalogAddr, pricingAddr, importAddr string) (*Clients, error) {
	opts := grpc.WithTransportCredentials(insecure.NewCredentials())

	catConn, err := grpc.NewClient(catalogAddr, opts)
	if err != nil {
		return nil, err
	}
	priConn, err := grpc.NewClient(pricingAddr, opts)
	if err != nil {
		return nil, err
	}
	impConn, err := grpc.NewClient(importAddr, opts)
	if err != nil {
		return nil, err
	}

	return &Clients{
		Catalog: catalogv1.NewCatalogServiceClient(catConn),
		Pricing: pricingv1.NewPricingServiceClient(priConn),
		Import:  importv1.NewImportServiceClient(impConn),
		conns:   []*grpc.ClientConn{catConn, priConn, impConn},
	}, nil
}

func (c *Clients) Close() {
	for _, conn := range c.conns {
		_ = conn.Close()
	}
}
