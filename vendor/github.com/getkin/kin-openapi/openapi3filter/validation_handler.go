package openapi3filter

import (
	"context"
	"net/http"
	"strings"

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
	// NOTE: users MUST set AuthenticationFunc explicitly or expect ErrAuthenticationServiceMissing when verifying SecurityRequirements
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

// ErrEncodedPathSeparator is returned when a request path holds an encoded path
// separator and the decoded path resolves to another operation than the escaped
// path does. Serving such a request would validate one operation while the
// wrapped handler serves the other one.
var ErrEncodedPathSeparator error = &routers.RouteError{Reason: "path contains an encoded path separator resolving to another operation"}

func (h *ValidationHandler) validateRequest(r *http.Request) error {
	// Find route
	route, pathParams, err := h.router.FindRoute(r)
	if err != nil {
		return err
	}

	if err := h.checkEncodedPathSeparator(r, route); err != nil {
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

// checkEncodedPathSeparator rejects a request whose encoded path separators make
// r.URL.Path and r.URL.RawPath select different operations. The router matches
// on the decoded path while routers such as gorilla/mux with UseEncodedPath
// match on the escaped one, so the operation validated here — its security
// requirements included — would not be the operation the wrapped handler serves.
func (h *ValidationHandler) checkEncodedPathSeparator(r *http.Request, route *routers.Route) error {
	escapedPath := r.URL.EscapedPath()
	segment := escapedPath
	for _, separator := range []string{"%2F", "%2f"} {
		segment = strings.ReplaceAll(segment, separator, "~")
	}
	if segment == escapedPath {
		return nil
	}

	shadow := r.Clone(r.Context())
	shadow.URL.Path, shadow.URL.RawPath = segment, ""
	escapedRoute, _, err := h.router.FindRoute(shadow)
	if err != nil ||
		escapedRoute.Method != route.Method ||
		escapedRoute.Path != route.Path ||
		escapedRoute.Operation != route.Operation {
		return ErrEncodedPathSeparator
	}

	return nil
}
