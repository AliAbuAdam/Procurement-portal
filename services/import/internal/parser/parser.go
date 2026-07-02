// Package parser разбирает файлы прайсов (Excel .xlsx и CSV) в таблицу строк.
package parser

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/furnica/backend/services/import/internal/domain"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/encoding/charmap"
)

// Parse определяет формат по расширению и возвращает заголовки + строки данных.
func Parse(fileName string, content []byte) (*domain.ParsedSheet, error) {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".xlsx":
		return parseXLSX(content)
	case ".csv", ".txt", "":
		return parseCSV(content)
	case ".xls":
		return nil, fmt.Errorf("формат .xls не поддерживается, сохраните файл как .xlsx")
	default:
		return nil, fmt.Errorf("неподдерживаемый формат файла: %s", filepath.Ext(fileName))
	}
}

func parseXLSX(content []byte) (*domain.ParsedSheet, error) {
	f, err := excelize.OpenReader(bytes.NewReader(content))
	if err != nil {
		return nil, fmt.Errorf("открыть xlsx: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("в файле нет листов")
	}
	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("чтение строк: %w", err)
	}
	return toSheet(rows), nil
}

func parseCSV(content []byte) (*domain.ParsedSheet, error) {
	// Кодировка: если не валидный UTF-8 — пробуем Windows-1251 (частый случай в РФ).
	text := content
	if !utf8.Valid(content) {
		if decoded, err := charmap.Windows1251.NewDecoder().Bytes(content); err == nil {
			text = decoded
		}
	}

	r := csv.NewReader(bytes.NewReader(text))
	r.Comma = detectDelimiter(text)
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	var rows [][]string
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("чтение csv: %w", err)
		}
		rows = append(rows, rec)
	}
	return toSheet(rows), nil
}

// detectDelimiter выбирает разделитель по первой строке (; , или таб).
func detectDelimiter(content []byte) rune {
	line := content
	if i := bytes.IndexByte(content, '\n'); i >= 0 {
		line = content[:i]
	}
	counts := map[rune]int{';': bytes.Count(line, []byte{';'}), ',': bytes.Count(line, []byte{','}), '\t': bytes.Count(line, []byte{'\t'})}
	best, bestN := ',', -1
	for d, n := range counts {
		if n > bestN {
			best, bestN = d, n
		}
	}
	return best
}

// toSheet: первая строка — заголовки, остальные — данные. Пустые хвостовые строки убираем.
func toSheet(rows [][]string) *domain.ParsedSheet {
	if len(rows) == 0 {
		return &domain.ParsedSheet{}
	}
	headers := trimTrailingEmpty(rows[0])
	data := make([][]string, 0, len(rows)-1)
	for _, r := range rows[1:] {
		if isEmptyRow(r) {
			continue
		}
		data = append(data, r)
	}
	return &domain.ParsedSheet{Headers: headers, Rows: data}
}

func isEmptyRow(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

func trimTrailingEmpty(row []string) []string {
	end := len(row)
	for end > 0 && strings.TrimSpace(row[end-1]) == "" {
		end--
	}
	return row[:end]
}
