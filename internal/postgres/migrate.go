package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"

	_ "github.com/jackc/pgx/v5/stdlib" // driver "pgx" для database/sql (нужен goose)
	"github.com/pressly/goose/v3"
)

// Migrate применяет миграции goose для конкретного сервиса.
//   - schema — схема сервиса (catalog / pricing / importer); создаётся при необходимости;
//   - fsys   — встроенная (//go:embed) файловая система с каталогом миграций;
//   - dir    — путь к миграциям внутри fsys (обычно "migrations").
//
// Таблица версий goose кладётся в схему сервиса, поэтому миграции разных
// сервисов в одной БД не конфликтуют.
func Migrate(ctx context.Context, dsn, schema string, fsys fs.FS, dir string) error {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer db.Close()

	// Схема должна существовать до создания таблицы версий goose.
	if _, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS "+schema); err != nil {
		return fmt.Errorf("create schema %s: %w", schema, err)
	}

	goose.SetBaseFS(fsys)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}
	goose.SetTableName(schema + ".goose_db_version")

	if err := goose.UpContext(ctx, db, dir); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	return nil
}
