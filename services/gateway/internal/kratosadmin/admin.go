// Package kratosadmin — тонкий клиент к Kratos Admin API для управления
// пользователями (список, создание). Роль пишем в metadata_public.role.
package kratosadmin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	adminURL string
	http     *http.Client
}

func New(adminURL string) *Client {
	return &Client{adminURL: adminURL, http: &http.Client{Timeout: 10 * time.Second}}
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

// identity — форма ответа Kratos (нужные поля).
type identity struct {
	ID     string `json:"id"`
	Traits struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	} `json:"traits"`
	MetadataPublic struct {
		Role string `json:"role"`
	} `json:"metadata_public"`
}

func (i identity) toUser() User {
	return User{ID: i.ID, Email: i.Traits.Email, Name: i.Traits.Name, Role: i.MetadataPublic.Role}
}

func (c *Client) List(ctx context.Context) ([]User, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.adminURL+"/admin/identities?per_page=250", nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, c.apiError(resp)
	}
	var ids []identity
	if err := json.NewDecoder(resp.Body).Decode(&ids); err != nil {
		return nil, err
	}
	out := make([]User, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.toUser())
	}
	return out, nil
}

func (c *Client) Create(ctx context.Context, email, name, role, password string) (*User, error) {
	body := map[string]any{
		"schema_id":       "user",
		"traits":          map[string]any{"email": email, "name": name},
		"metadata_public": map[string]any{"role": role},
		"credentials": map[string]any{
			"password": map[string]any{"config": map[string]any{"password": password}},
		},
	}
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.adminURL+"/admin/identities", bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		return nil, c.apiError(resp)
	}
	var id identity
	if err := json.NewDecoder(resp.Body).Decode(&id); err != nil {
		return nil, err
	}
	u := id.toUser()
	return &u, nil
}

// AdminError несёт HTTP-статус, чтобы gateway отдал корректный код наружу.
type AdminError struct {
	Status  int
	Message string
}

func (e *AdminError) Error() string { return e.Message }

func (c *Client) apiError(resp *http.Response) error {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<10))
	msg := fmt.Sprintf("kratos admin: %s", resp.Status)
	// Пытаемся вытащить человекочитаемое сообщение.
	var parsed struct {
		Error struct {
			Message string `json:"message"`
			Reason  string `json:"reason"`
		} `json:"error"`
	}
	if json.Unmarshal(b, &parsed) == nil && parsed.Error.Message != "" {
		msg = parsed.Error.Message
		if parsed.Error.Reason != "" {
			msg += ": " + parsed.Error.Reason
		}
	}
	return &AdminError{Status: resp.StatusCode, Message: msg}
}
