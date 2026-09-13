// Package storage — объектное хранилище фото (S3-совместимое: Selectel,
// MinIO). Реализует domain.ImageStore.
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/furnica/backend/internal/env"
)

type S3Store struct {
	mc     *minio.Client
	bucket string
}

// NewS3FromEnv собирает хранилище из S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/
// S3_SECRET_KEY (+опц. S3_REGION). Пустой S3_ENDPOINT — S3 не настроен,
// возвращается (nil, nil): байты фото остаются в Postgres.
func NewS3FromEnv(ctx context.Context) (*S3Store, error) {
	endpoint := env.Get("S3_ENDPOINT", "")
	if endpoint == "" {
		return nil, nil
	}
	bucket := env.Get("S3_BUCKET", "")
	access := env.Get("S3_ACCESS_KEY", "")
	secret := env.Get("S3_SECRET_KEY", "")
	if bucket == "" || access == "" || secret == "" {
		return nil, fmt.Errorf("s3: S3_ENDPOINT задан, но S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY — нет")
	}

	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" {
		return nil, fmt.Errorf("s3: некорректный S3_ENDPOINT %q (нужен вида https://s3.ru-1.storage.selcloud.ru)", endpoint)
	}

	// Стиль адресации: vHosted-бакеты Selectel требуют DNS-стиль
	// (bucket.s3...), локальный MinIO — path-стиль. По умолчанию выбираем по
	// хосту, S3_ADDRESSING=vhost|path переопределяет вручную.
	lookup := minio.BucketLookupAuto
	if strings.HasSuffix(u.Hostname(), ".selcloud.ru") {
		lookup = minio.BucketLookupDNS
	}
	switch env.Get("S3_ADDRESSING", "") {
	case "vhost":
		lookup = minio.BucketLookupDNS
	case "path":
		lookup = minio.BucketLookupPath
	}

	mc, err := minio.New(u.Host, &minio.Options{
		Creds:        credentials.NewStaticV4(access, secret, ""),
		Secure:       u.Scheme != "http",
		Region:       env.Get("S3_REGION", ""),
		BucketLookup: lookup,
	})
	if err != nil {
		return nil, fmt.Errorf("s3: init client: %w", err)
	}

	s := &S3Store{mc: mc, bucket: bucket}
	// Проверяем доступность и создаём бакет, если его нет (локальный MinIO).
	// В Selectel бакет обычно создан заранее — тогда это просто health-check.
	checkCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	exists, err := mc.BucketExists(checkCtx, bucket)
	if err != nil {
		return nil, fmt.Errorf("s3: bucket check (%s): %w", endpoint, err)
	}
	if !exists {
		if err := mc.MakeBucket(checkCtx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("s3: бакет %q не существует и создать не удалось: %w", bucket, err)
		}
		log.Printf("s3: бакет %q создан", bucket)
	}
	return s, nil
}

func (s *S3Store) Put(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := s.mc.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return fmt.Errorf("s3 put %s: %w", key, err)
	}
	return nil
}

func (s *S3Store) Get(ctx context.Context, key string) ([]byte, error) {
	obj, err := s.mc.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("s3 get %s: %w", key, err)
	}
	defer obj.Close()
	data, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("s3 read %s: %w", key, err)
	}
	return data, nil
}

// Delete — best-effort: объект мог не существовать, это не ошибка запроса.
func (s *S3Store) Delete(ctx context.Context, keys ...string) error {
	for _, key := range keys {
		if key == "" {
			continue
		}
		if err := s.mc.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
			log.Printf("s3: remove %s: %v", key, err)
		}
	}
	return nil
}

// DeletePrefix удаляет все объекты с префиксом (админ-очистка данных).
func (s *S3Store) DeletePrefix(ctx context.Context, prefix string) error {
	if !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	objects := s.mc.ListObjects(ctx, s.bucket, minio.ListObjectsOptions{Prefix: prefix, Recursive: true})
	for res := range s.mc.RemoveObjects(ctx, s.bucket, objects, minio.RemoveObjectsOptions{}) {
		if res.Err != nil {
			return fmt.Errorf("s3 remove prefix %s (%s): %w", prefix, res.ObjectName, res.Err)
		}
	}
	return nil
}
