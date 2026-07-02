// Package migrations встраивает .sql-миграции goose в бинарник сервиса.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
