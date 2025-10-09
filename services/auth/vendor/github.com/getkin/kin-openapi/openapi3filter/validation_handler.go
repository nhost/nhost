package openapi3filter

import (
	"context"
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers"
	legacyrouter "github.com/getkin/kin-openapi/routers/legacy"
)

// AuthenticationFunc allows for custom security requirement validation.
// A non-nil error fails authentication according to https://spec.openapis.org/oas/v3.1.0#security-requirement-object
// See ValidateSecurityRequirements
type AuthenticationFunc func(context.Context, *AuthenticationInput) error

// NoopAuthenticationFunc is an AuthenticationFunc
func NoopAuthenticationFunc(context.Context, *AuthenticationInput) error { return nil }

var _ AuthenticationFunc = NoopAuthenticationFunc

type ValidationHandler struct {
	Handler            http.Handler
	AuthenticationFunc AuthenticationFunc
	File               string
	ErrorEncoder       ErrorEncoder
	router             routers.Router
}

func (h *ValidationHandler) Load() error {
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile(h.File)
	if err != nil {
		return err
	}
	if err := doc.Validate(loader.Context); err != nil {
		return err
	}
	if h.router, err = legacyrouter.NewRouter(doc); err != nil {
		return err
	}

	// set defaults
	if h.Handler == nil {
		h.Handler = http.DefaultServeMux
	}
	if h.AuthenticationFunc == nil {
		h.AuthenticationFunc = NoopAuthenticationFunc
	}
	if h.ErrorEncoder == nil {
		h.ErrorEncoder = DefaultErrorEncoder
	}

	return nil
}

func (h *ValidationHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if handled := h.before(w, r); handled {
		return
	}
	// TODO: validateResponse
	h.Handler.ServeHTTP(w, r)
}

// Middleware implements gorilla/mux MiddlewareFunc
func (h *ValidationHandler) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if handled := h.before(w, r); handled {
			return
		}
		// TODO: validateResponse
		next.ServeHTTP(w, r)
	})
}

func (h *ValidationHandler) before(w http.ResponseWriter, r *http.Request) (handled bool) {
	if err := h.validateRequest(r); err != nil {
		h.ErrorEncoder(r.Context(), err, w)
		return true
	}
	return false
}

func (h *ValidationHandler) validateRequest(r *http.Request) error {
	// Find route
	route, pathParams, err := h.router.FindRoute(r)
	if err != nil {
		return err
	}

	options := &Options{
		AuthenticationFunc: h.AuthenticationFunc,
	}

	// Validate request
	requestValidationInput := &RequestValidationInput{
		Request:    r,
		PathParams: pathParams,
		Route:      route,
		Options:    options,
	}
	if err = ValidateRequest(r.Context(), requestValidationInput); err != nil {
		return err
	}

	return nil
}
