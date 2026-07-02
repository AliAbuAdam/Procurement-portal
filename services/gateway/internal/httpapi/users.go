package httpapi

import (
	"errors"
	"net/http"

	"github.com/furnica/backend/services/gateway/internal/kratosadmin"
)

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.admin.List(r.Context())
	if err != nil {
		writeAdminError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Role     string `json:"role"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json body"})
		return
	}
	if body.Email == "" || body.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email и пароль обязательны"})
		return
	}
	if body.Role != "admin" && body.Role != "manager" {
		body.Role = "manager"
	}

	user, err := h.admin.Create(r.Context(), body.Email, body.Name, body.Role, body.Password)
	if err != nil {
		writeAdminError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func writeAdminError(w http.ResponseWriter, err error) {
	var ae *kratosadmin.AdminError
	if errors.As(err, &ae) {
		writeJSON(w, ae.Status, map[string]string{"error": ae.Message})
		return
	}
	writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
}
