package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Querier — общий интерфейс для *pgxpool.Pool и pgx.Tx.
// Репозитории работают только с ним и не знают, идёт ли запрос в транзакции.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error)
}

// компайл-тайм проверки, что типы pgx удовлетворяют Querier.
var (
	_ Querier = (*pgxpool.Pool)(nil)
	_ Querier = (pgx.Tx)(nil)
)

type txCtxKey struct{}

// TxManager — менеджер транзакций. Слой service оборачивает несколько операций
// репозиториев в WithinTx; репозитории через Querier(ctx) сами получают либо
// активную транзакцию из контекста, либо пул.
type TxManager struct {
	pool *pgxpool.Pool
}

func NewTxManager(pool *pgxpool.Pool) *TxManager {
	return &TxManager{pool: pool}
}

// WithinTx выполняет fn в одной транзакции. Транзакция кладётся в контекст,
// поэтому все репозитории, вызванные внутри fn, работают в ней же.
// Вложенный вызов переиспользует уже открытую транзакцию (без savepoint'ов).
func (m *TxManager) WithinTx(ctx context.Context, fn func(ctx context.Context) error) (err error) {
	if _, ok := ctx.Value(txCtxKey{}).(pgx.Tx); ok {
		return fn(ctx) // уже в транзакции — переиспользуем
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(context.Background())
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback(context.Background())
		}
	}()

	if err = fn(context.WithValue(ctx, txCtxKey{}, tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Querier возвращает активную транзакцию из контекста либо пул соединений.
func (m *TxManager) Querier(ctx context.Context) Querier {
	if tx, ok := ctx.Value(txCtxKey{}).(pgx.Tx); ok {
		return tx
	}
	return m.pool
}
