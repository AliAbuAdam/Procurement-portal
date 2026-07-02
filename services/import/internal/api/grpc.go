// Package api — транспортный слой import (gRPC).
package api

import (
	"context"
	"errors"

	importv1 "github.com/furnica/backend/gen/import/v1"
	"github.com/furnica/backend/services/import/internal/domain"
	"github.com/furnica/backend/services/import/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type ImportServer struct {
	importv1.UnimplementedImportServiceServer
	imports *service.ImportService
}

func NewImportServer(imports *service.ImportService) *ImportServer {
	return &ImportServer{imports: imports}
}

func (s *ImportServer) HealthCheck(context.Context, *importv1.HealthCheckRequest) (*importv1.HealthCheckResponse, error) {
	return &importv1.HealthCheckResponse{Status: "ok", Service: "import"}, nil
}

func (s *ImportServer) PreviewFile(ctx context.Context, req *importv1.PreviewFileRequest) (*importv1.FilePreview, error) {
	p, err := s.imports.Preview(ctx, req.GetFileName(), req.GetContent())
	if err != nil {
		return nil, toStatus(err)
	}
	rows := make([]*importv1.PreviewRow, 0, len(p.Rows))
	for _, r := range p.Rows {
		rows = append(rows, &importv1.PreviewRow{Cells: r})
	}
	return &importv1.FilePreview{
		Headers:   p.Headers,
		Rows:      rows,
		Suggested: mappingToProto(p.Suggested),
		TotalRows: int32(p.TotalRows),
	}, nil
}

func (s *ImportServer) ProcessFile(ctx context.Context, req *importv1.ProcessFileRequest) (*importv1.ImportBatch, error) {
	b, err := s.imports.Process(ctx, req.GetSupplierId(), req.GetFileName(), req.GetContent(), mappingFromProto(req.GetMapping()), req.GetCreatedBy())
	if err != nil {
		return nil, toStatus(err)
	}
	return batchToProto(b), nil
}

func (s *ImportServer) GetImportBatch(ctx context.Context, req *importv1.GetImportBatchRequest) (*importv1.ImportBatch, error) {
	b, err := s.imports.GetBatch(ctx, req.GetId())
	if err != nil {
		return nil, toStatus(err)
	}
	return batchToProto(b), nil
}

func (s *ImportServer) ListBatches(ctx context.Context, req *importv1.ListBatchesRequest) (*importv1.ListBatchesResponse, error) {
	list, err := s.imports.ListBatches(ctx, req.GetSupplierId())
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*importv1.ImportBatch, 0, len(list))
	for _, b := range list {
		out = append(out, batchToProto(b))
	}
	return &importv1.ListBatchesResponse{Batches: out}, nil
}

func (s *ImportServer) ListOffers(ctx context.Context, req *importv1.ListOffersRequest) (*importv1.ListOffersResponse, error) {
	offers, total, err := s.imports.ListOffers(ctx, req.GetBatchId(), int(req.GetPageSize()), int(req.GetOffset()))
	if err != nil {
		return nil, toStatus(err)
	}
	out := make([]*importv1.SupplierOffer, 0, len(offers))
	for _, o := range offers {
		out = append(out, &importv1.SupplierOffer{
			Id:         o.ID,
			BatchId:    o.BatchID,
			SupplierId: o.SupplierID,
			RowNum:     int32(o.RowNum),
			RawName:    o.RawName,
			RawArticle: o.RawArticle,
			Price:      o.Price,
			Currency:   o.Currency,
			InStock:    o.InStock,
			StockQty:   o.StockQty,
		})
	}
	return &importv1.ListOffersResponse{Offers: out, Total: int32(total)}, nil
}

// --- маппинг ---

func mappingFromProto(m *importv1.ColumnMapping) domain.ColumnMapping {
	if m == nil {
		return domain.ColumnMapping{Name: -1, Article: -1, Price: -1, Stock: -1, Currency: -1}
	}
	return domain.ColumnMapping{
		Name:     int(m.GetNameCol()),
		Article:  int(m.GetArticleCol()),
		Price:    int(m.GetPriceCol()),
		Stock:    int(m.GetStockCol()),
		Currency: int(m.GetCurrencyCol()),
	}
}

func mappingToProto(m domain.ColumnMapping) *importv1.ColumnMapping {
	return &importv1.ColumnMapping{
		NameCol:     int32(m.Name),
		ArticleCol:  int32(m.Article),
		PriceCol:    int32(m.Price),
		StockCol:    int32(m.Stock),
		CurrencyCol: int32(m.Currency),
	}
}

func batchToProto(b *domain.ImportBatch) *importv1.ImportBatch {
	return &importv1.ImportBatch{
		Id:          b.ID,
		SupplierId:  b.SupplierID,
		FileName:    b.FileName,
		Status:      statusToProto(b.Status),
		RowsTotal:   int32(b.RowsTotal),
		RowsMatched: int32(b.RowsMatched),
		CreatedBy:   b.CreatedBy,
		CreatedAt:   b.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func statusToProto(s domain.ImportStatus) importv1.ImportStatus {
	switch s {
	case domain.StatusPending:
		return importv1.ImportStatus_IMPORT_STATUS_PENDING
	case domain.StatusProcessing:
		return importv1.ImportStatus_IMPORT_STATUS_PROCESSING
	case domain.StatusDone:
		return importv1.ImportStatus_IMPORT_STATUS_DONE
	case domain.StatusFailed:
		return importv1.ImportStatus_IMPORT_STATUS_FAILED
	default:
		return importv1.ImportStatus_IMPORT_STATUS_UNSPECIFIED
	}
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
