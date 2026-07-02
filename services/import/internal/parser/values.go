package parser

import (
	"strconv"
	"strings"
)

// ParsePrice нормализует строку цены: "1 234,56 ₽" -> 1234.56.
func ParsePrice(s string) float64 {
	var b strings.Builder
	for _, r := range s {
		if (r >= '0' && r <= '9') || r == ',' || r == '.' || r == '-' {
			b.WriteRune(r)
		}
	}
	v := b.String()
	// И точка, и запятая: точка — разделитель тысяч, запятая — дробная.
	if strings.Contains(v, ",") && strings.Contains(v, ".") {
		v = strings.ReplaceAll(v, ".", "")
	}
	v = strings.ReplaceAll(v, ",", ".")
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0
	}
	return f
}

var stockYesWords = []string{"да", "есть", "в наличии", "наличие", "+", "yes", "true", "instock"}

// ParseStock: число -> (есть при >0, кол-во); текст -> распознаём «да/есть/...».
func ParseStock(s string) (bool, int64) {
	s = strings.TrimSpace(s)
	if s == "" {
		return false, 0
	}
	// Убираем пробелы-разделители тысяч ("1 200") и пробуем как целое число.
	digits := strings.ReplaceAll(s, " ", "")
	digits = strings.ReplaceAll(digits, " ", "")
	if n, err := strconv.ParseInt(digits, 10, 64); err == nil {
		return n > 0, n
	}
	low := strings.ToLower(s)
	for _, w := range stockYesWords {
		if strings.Contains(low, w) {
			return true, 0
		}
	}
	return false, 0
}
