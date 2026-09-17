package service

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	// Регистрация декодеров для image.Decode.
	_ "image/gif"
	_ "image/png"

	"github.com/furnica/backend/internal/env"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// Габариты как у клиентского сжатия (lib/image.ts): оригинал ~1600px, thumb ~320px.
const (
	fetchMaxSide      = 1600
	fetchThumbSide    = 320
	fetchJPEGQuality  = 85
	fetchMaxDownload  = 20 << 20 // 20 МиБ сырого файла — дальше обрываем
	fetchTimeout      = 20 * time.Second
)

// ImageFetcher скачивает фото товара по URL (колонка прайса, позже — парсинг и
// API поставщиков), проверяет, что это картинка, и приводит к размерам галереи.
type ImageFetcher struct {
	client       *http.Client
	allowPrivate bool // разрешить приватные адреса (dev-окружение)
}

// NewImageFetcherFromEnv: IMAGE_FETCH_ALLOW_PRIVATE=1 отключает защиту от
// запросов во внутреннюю сеть (нужно только в локальной разработке).
func NewImageFetcherFromEnv() *ImageFetcher {
	return &ImageFetcher{
		client:       &http.Client{Timeout: fetchTimeout},
		allowPrivate: env.Get("IMAGE_FETCH_ALLOW_PRIVATE", "") == "1",
	}
}

// Fetch скачивает картинку и возвращает JPEG-байты оригинала (~1600px по
// длинной стороне) и миниатюры (~320px) — ровно то, что ждёт AddProductImage.
func (f *ImageFetcher) Fetch(ctx context.Context, rawURL string) (data, thumb []byte, contentType string, err error) {
	if err := f.checkURL(rawURL); err != nil {
		return nil, nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, nil, "", fmt.Errorf("некорректная ссылка: %w", err)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, nil, "", fmt.Errorf("скачивание фото: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, "", fmt.Errorf("скачивание фото: HTTP %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, fetchMaxDownload+1))
	if err != nil {
		return nil, nil, "", fmt.Errorf("чтение фото: %w", err)
	}
	if len(raw) > fetchMaxDownload {
		return nil, nil, "", fmt.Errorf("фото больше %d МБ", fetchMaxDownload>>20)
	}
	// Тип определяем по содержимому, а не по заголовкам сервера.
	if ct := http.DetectContentType(raw); !strings.HasPrefix(ct, "image/") {
		return nil, nil, "", fmt.Errorf("по ссылке не картинка (%s)", ct)
	}

	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, nil, "", fmt.Errorf("разбор картинки: %w", err)
	}
	if data, err = encodeResized(src, fetchMaxSide); err != nil {
		return nil, nil, "", err
	}
	if thumb, err = encodeResized(src, fetchThumbSide); err != nil {
		return nil, nil, "", err
	}
	if len(data) > maxImageBytes || len(thumb) > maxThumbBytes {
		return nil, nil, "", fmt.Errorf("фото слишком большое после сжатия")
	}
	return data, thumb, "image/jpeg", nil
}

// checkURL — только http(s) и, вне dev, только публичные адреса: ссылка из
// прайса не должна дотягиваться до внутренних сервисов (SSRF).
func (f *ImageFetcher) checkURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("некорректная ссылка: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("поддерживаются только http/https-ссылки")
	}
	if f.allowPrivate {
		return nil
	}
	ips, err := net.LookupIP(u.Hostname())
	if err != nil {
		return fmt.Errorf("не удалось разрешить адрес %q: %w", u.Hostname(), err)
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			return fmt.Errorf("ссылка ведёт на внутренний адрес — отклонено")
		}
	}
	return nil
}

// encodeResized уменьшает картинку до maxSide по длинной стороне (маленькую не
// растягиваем) и кодирует в JPEG поверх белого фона (гасим прозрачность PNG/WebP).
func encodeResized(src image.Image, maxSide int) ([]byte, error) {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 {
		return nil, fmt.Errorf("пустая картинка")
	}
	scale := 1.0
	if w > h && w > maxSide {
		scale = float64(maxSide) / float64(w)
	} else if h >= w && h > maxSide {
		scale = float64(maxSide) / float64(h)
	}
	dw, dh := int(float64(w)*scale), int(float64(h)*scale)
	if dw < 1 {
		dw = 1
	}
	if dh < 1 {
		dh = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: fetchJPEGQuality}); err != nil {
		return nil, fmt.Errorf("кодирование JPEG: %w", err)
	}
	return buf.Bytes(), nil
}
