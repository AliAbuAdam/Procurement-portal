package httpapi

import (
	"net/http"

	"github.com/furnica/backend/services/gateway/internal/auth"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// NewRouter собирает REST-маршруты gateway.
//   - /healthz — без авторизации;
//   - /api/v1/* — требует активной сессии Kratos;
//   - изменение справочников (создание поставщика) — только роль admin.
func NewRouter(h *Handler, k *auth.Kratos, allowedOrigins []string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Session-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "gateway"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(k.Middleware) // все /api/v1 — только аутентифицированным

		r.Get("/me", h.Me)

		// Поставщики: чтение — всем, создание — только admin.
		r.Get("/suppliers", h.ListSuppliers)
		r.With(auth.RequireRole(auth.RoleAdmin)).Post("/suppliers", h.CreateSupplier)
		r.With(auth.RequireRole(auth.RoleAdmin)).Put("/suppliers/{id}", h.UpdateSupplier)
		r.With(auth.RequireRole(auth.RoleAdmin)).Delete("/suppliers/{id}", h.DeleteSupplier)

		// Номенклатура и сопоставление: доступно и admin, и manager (рабочий процесс).
		r.Get("/products", h.ListProducts)
		r.Post("/products", h.CreateProduct)
		r.Get("/imports/{id}/unmatched", h.ListUnmatchedOffers)
		r.Post("/matches/suggest", h.SuggestMatches)
		r.Post("/matches", h.ConfirmMatch)
		r.Post("/matches/from-offer", h.CreateProductFromOffer)
		r.Delete("/matches/{offerID}", h.Unmatch)

		// Сравнение цен по товару — чтение всем ролям.
		r.Get("/products/{productID}/prices", h.CompareByProduct)

		// Импорт прайсов: создают и смотрят и admin, и manager.
		r.Post("/imports/preview", h.PreviewImport)
		r.Post("/imports", h.CreateImport)
		r.Get("/imports", h.ListImports)
		r.Get("/imports/{id}", h.GetImport)
		r.Get("/imports/{id}/offers", h.ListImportOffers)

		// Управление пользователями — только admin.
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireRole(auth.RoleAdmin))
			r.Get("/users", h.ListUsers)
			r.Post("/users", h.CreateUser)
		})
	})

	return r
}
