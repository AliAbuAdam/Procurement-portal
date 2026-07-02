// Package auth — проверка сессии Ory Kratos и ролевой доступ (RBAC).
//
// Kratos отвечает за аутентификацию (кто ты). Авторизацию для двух ролей
// (admin/manager) делаем здесь: роль хранится в identity.metadata_public.role,
// её нельзя менять через self-service — только через Admin API.
package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Role string

const (
	RoleAdmin   Role = "admin"
	RoleManager Role = "manager"
)

// Principal — аутентифицированный пользователь текущего запроса.
type Principal struct {
	ID    string
	Email string
	Role  Role
}

type ctxKey struct{}

// FromContext возвращает пользователя из контекста запроса.
func FromContext(ctx context.Context) (*Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(*Principal)
	return p, ok
}

// Kratos проверяет сессию через public-эндпоинт /sessions/whoami.
type Kratos struct {
	publicURL string
	http      *http.Client
}

func NewKratos(publicURL string) *Kratos {
	return &Kratos{
		publicURL: publicURL,
		http:      &http.Client{Timeout: 5 * time.Second},
	}
}

// whoami-ответ Kratos (нужные поля).
type session struct {
	Active   bool `json:"active"`
	Identity struct {
		ID     string `json:"id"`
		Traits struct {
			Email string `json:"email"`
		} `json:"traits"`
		MetadataPublic struct {
			Role string `json:"role"`
		} `json:"metadata_public"`
	} `json:"identity"`
}

// Middleware проверяет сессию и кладёт Principal в контекст.
// Пробрасывает cookie и Authorization из исходного запроса в Kratos.
func (k *Kratos) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, err := k.whoami(r)
		if err != nil {
			http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey{}, p)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (k *Kratos) whoami(r *http.Request) (*Principal, error) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, k.publicURL+"/sessions/whoami", nil)
	if err != nil {
		return nil, err
	}
	if c := r.Header.Get("Cookie"); c != "" {
		req.Header.Set("Cookie", c)
	}
	if a := r.Header.Get("Authorization"); a != "" {
		req.Header.Set("Authorization", a)
	}
	// Для API-клиентов (не браузер) — сессия через X-Session-Token.
	if t := r.Header.Get("X-Session-Token"); t != "" {
		req.Header.Set("X-Session-Token", t)
	}

	resp, err := k.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errUnauthenticated
	}

	var s session
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		return nil, err
	}
	if !s.Active {
		return nil, errUnauthenticated
	}
	role := Role(s.Identity.MetadataPublic.Role)
	if role != RoleAdmin && role != RoleManager {
		role = RoleManager // безопасный дефолт: минимальные права
	}
	return &Principal{
		ID:    s.Identity.ID,
		Email: s.Identity.Traits.Email,
		Role:  role,
	}, nil
}

// RequireRole пропускает только пользователей с одной из указанных ролей.
func RequireRole(roles ...Role) func(http.Handler) http.Handler {
	allowed := make(map[Role]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := FromContext(r.Context())
			if !ok {
				http.Error(w, `{"error":"unauthenticated"}`, http.StatusUnauthorized)
				return
			}
			if _, ok := allowed[p.Role]; !ok {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type authError string

func (e authError) Error() string { return string(e) }

const errUnauthenticated authError = "unauthenticated"
