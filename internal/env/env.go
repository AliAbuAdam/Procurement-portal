// Package env — небольшие помощники для чтения переменных окружения.
package env

import "os"

// Get возвращает значение переменной окружения или fallback, если она пуста.
func Get(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
