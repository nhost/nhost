// Package middleware provides the HTTP middleware that implements session
// refresh, access-token attachment, session capture, and role/header/admin
// injection. Each function returns a [transport.Middleware] that decorates an
// [http.RoundTripper].
package middleware

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

// DefaultMarginSeconds is the default number of seconds before expiry at which
// the session-refresh middleware refreshes the access token.
const DefaultMarginSeconds = 60

var errInvalidServiceURL = errors.New("invalid service URL: expected an HTTP(S) URL with a host")

type requestScope struct {
	scheme     string
	host       string
	pathPrefix string
}

func newRequestScope(baseURL string) (requestScope, error) {
	parsed, err := url.Parse(transport.NormalizeServiceURL(baseURL))
	if err != nil {
		return requestScope{}, fmt.Errorf("%w %q: %w", errInvalidServiceURL, baseURL, err)
	}

	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return requestScope{}, fmt.Errorf("%w: %q", errInvalidServiceURL, baseURL)
	}

	return requestScope{
		scheme:     parsed.Scheme,
		host:       parsed.Host,
		pathPrefix: strings.TrimRight(parsed.Path, "/"),
	}, nil
}

func (s requestScope) contains(reqURL *url.URL) bool {
	return s.host != "" &&
		strings.EqualFold(reqURL.Scheme, s.scheme) &&
		strings.EqualFold(reqURL.Host, s.host)
}

func (s requestScope) permitsAdminSession(reqURL *url.URL, allowInsecureHTTP bool) bool {
	return s.contains(reqURL) &&
		(strings.EqualFold(reqURL.Scheme, "https") ||
			allowInsecureHTTP ||
			transport.IsLoopbackHost(reqURL.Hostname()))
}

func (s requestScope) logWithheldAdminSecret(
	reqURL *url.URL,
	options AdminSessionOptions,
) {
	if !s.contains(reqURL) ||
		!strings.EqualFold(reqURL.Scheme, "http") ||
		transport.IsLoopbackHost(reqURL.Hostname()) ||
		options.AllowInsecureHTTP ||
		options.AdminSecret == "" {
		return
	}

	slog.Debug(
		"admin secret withheld from insecure HTTP request",
		"host", reqURL.Host,
	)
}

// AttachAccessToken attaches "Authorization: Bearer <access_token>" from the
// stored session to requests for serviceURL. It should run after the refresh
// middleware so the freshest token is used, and skips requests that already
// carry an Authorization header.
func AttachAccessToken(storage *session.Storage, serviceURL string) transport.Middleware {
	scope, scopeErr := newRequestScope(serviceURL)

	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			if scopeErr != nil {
				return nil, scopeErr
			}

			if scope.contains(req.URL) {
				if req.Header.Get("Authorization") != "" {
					return next.RoundTrip(req)
				}

				if s, ok := storage.Get(); ok && s.AccessToken != "" {
					req = req.Clone(req.Context())
					req.Header.Set("Authorization", "Bearer "+s.AccessToken)
				}

				return next.RoundTrip(req)
			}

			if req.Header.Get("Authorization") == "" {
				return next.RoundTrip(req)
			}

			if s, ok := storage.Get(); ok &&
				s.AccessToken != "" &&
				req.Header.Get("Authorization") == "Bearer "+s.AccessToken {
				req = req.Clone(req.Context())
				req.Header.Del("Authorization")
			}

			return next.RoundTrip(req)
		})
	}
}

// SessionRefresh refreshes the session before a request when the token is near
// expiry. It skips requests that already carry an Authorization header and the
// token endpoint itself (to avoid recursively refreshing during a refresh).
func SessionRefresh(
	authClient *auth.Client,
	storage *session.Storage,
	marginSeconds int,
) transport.Middleware {
	authScope, scopeErr := newRequestScope(authClient.BaseURL)

	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			if scopeErr != nil {
				return nil, scopeErr
			}

			isAuthTokenRequest := authScope.contains(req.URL) &&
				req.URL.Path == authScope.pathPrefix+"/token"
			if req.Header.Get("Authorization") == "" && !isAuthTokenRequest {
				if _, err := session.RefreshSession(
					req.Context(), authClient, storage, marginSeconds,
				); err != nil {
					slog.Debug("session refresh failed; continuing", "error", err)
				}
			}

			return next.RoundTrip(req)
		})
	}
}

func extractSession(data []byte) *auth.Session {
	var raw map[string]json.RawMessage
	if json.Unmarshal(data, &raw) != nil {
		return nil
	}

	if sessRaw, ok := raw["session"]; ok {
		if string(sessRaw) == "null" {
			return nil
		}

		var s auth.Session
		if json.Unmarshal(sessRaw, &s) == nil {
			return &s
		}

		return nil
	}

	// The body may itself be a raw session (e.g. a direct /token refresh
	// response). We can't key off "user": the auth service serialises it with
	// omitempty and omits it entirely when the user has no profile, so require
	// only the always-present token fields.
	_, hasAT := raw["accessToken"]
	_, hasRT := raw["refreshToken"]

	if hasAT && hasRT {
		var s auth.Session
		if json.Unmarshal(data, &s) == nil {
			return &s
		}
	}

	return nil
}

type sessionResponseAction uint8

const (
	sessionResponseIgnore sessionResponseAction = iota
	sessionResponseRemove
	sessionResponseRemoveOnSuccess
	sessionResponseStore
)

func sessionAction(scope requestScope, reqURL *url.URL) sessionResponseAction {
	if !scope.contains(reqURL) {
		return sessionResponseIgnore
	}

	path := reqURL.Path
	prefix := scope.pathPrefix

	switch path {
	case prefix + "/signout":
		return sessionResponseRemove
	case prefix + "/user/password":
		return sessionResponseRemoveOnSuccess
	case prefix + "/token", prefix + "/token/exchange":
		return sessionResponseStore
	}

	if strings.HasPrefix(path, prefix+"/signin/") || strings.HasPrefix(path, prefix+"/signup/") {
		return sessionResponseStore
	}

	return sessionResponseIgnore
}

func storeSessionFromResponse(storage *session.Storage, resp *http.Response) {
	data, readErr := io.ReadAll(resp.Body)
	if closeErr := resp.Body.Close(); closeErr != nil {
		slog.Debug("error closing auth response body", "error", closeErr)
	}

	resp.Body = io.NopCloser(bytes.NewReader(data))
	if readErr != nil || len(data) == 0 {
		return
	}

	s := extractSession(data)
	if s == nil || s.AccessToken == "" || s.RefreshToken == "" {
		return
	}

	if err := storage.Set(*s); err != nil {
		slog.Warn("error storing session from response", "error", err)
	}
}

func updateSession(storage *session.Storage, action sessionResponseAction, resp *http.Response) {
	switch action {
	case sessionResponseRemove:
		storage.Remove()
	case sessionResponseRemoveOnSuccess:
		if resp.StatusCode < http.StatusMultipleChoices {
			storage.Remove()
		}
	case sessionResponseStore:
		storeSessionFromResponse(storage, resp)
	case sessionResponseIgnore:
	}
}

// UpdateSessionFromResponse persists session data returned by auth endpoints
// under authURL and clears it on sign-out. It reads and then restores the
// response body so downstream decoding still works.
func UpdateSessionFromResponse(storage *session.Storage, authURL string) transport.Middleware {
	scope, scopeErr := newRequestScope(authURL)

	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			if scopeErr != nil {
				return nil, scopeErr
			}

			resp, err := next.RoundTrip(req)
			if err != nil {
				// RoundTripper contract: return transport errors unwrapped.
				return resp, err //nolint:wrapcheck
			}

			updateSession(storage, sessionAction(scope, req.URL), resp)

			return resp, nil
		})
	}
}

// WithRole sets x-hasura-role on requests that don't already specify it.
func WithRole(role string) transport.Middleware {
	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("x-hasura-role") == "" {
				req = req.Clone(req.Context())
				req.Header.Set("x-hasura-role", role)
			}

			return next.RoundTrip(req)
		})
	}
}

// WithHeaders attaches default headers, preserving any request-specific values.
// The caller is responsible for not supplying credentials: default headers are
// intentionally unscoped and are reapplied when the HTTP client follows a
// redirect. Use the scoped access-token or admin-session middleware for secrets.
func WithHeaders(defaultHeaders map[string]string) transport.Middleware {
	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			out := req

			for key, value := range defaultHeaders {
				if out.Header.Get(key) == "" {
					if out == req {
						out = req.Clone(req.Context())
					}

					out.Header.Set(key, value)
				}
			}

			return next.RoundTrip(out)
		})
	}
}

// AdminSessionOptions configures the admin-session middleware.
//
// Security warning: never use in untrusted/client code — the admin secret
// grants unrestricted database access.
type AdminSessionOptions struct {
	AdminSecret      string
	Role             string
	SessionVariables map[string]string
	// AllowInsecureHTTP sends admin credentials in cleartext to the configured
	// service origin. Prefer HTTPS; enable this only for a trusted development
	// network when loopback is not usable.
	AllowInsecureHTTP bool
}

// WithAdminSession attaches x-hasura-admin-secret and optional role/session
// variables to requests for serviceURL. Admin sessions are only sent over HTTPS
// or to a loopback development server unless AllowInsecureHTTP is enabled.
func WithAdminSession(options AdminSessionOptions, serviceURL string) transport.Middleware {
	scope, scopeErr := newRequestScope(serviceURL)

	return func(next http.RoundTripper) http.RoundTripper {
		return transport.RoundTripFunc(func(req *http.Request) (*http.Response, error) {
			if scopeErr != nil {
				return nil, scopeErr
			}

			if !scope.permitsAdminSession(req.URL, options.AllowInsecureHTTP) {
				scope.logWithheldAdminSecret(req.URL, options)

				if options.AdminSecret != "" &&
					req.Header.Get("x-hasura-admin-secret") == options.AdminSecret {
					req = req.Clone(req.Context())
					req.Header.Del("x-hasura-admin-secret")
				}

				return next.RoundTrip(req)
			}

			out := req
			setHeader := func(key, value string) {
				if value == "" || out.Header.Get(key) != "" {
					return
				}

				if out == req {
					out = req.Clone(req.Context())
				}

				out.Header.Set(key, value)
			}

			setHeader("x-hasura-admin-secret", options.AdminSecret)
			setHeader("x-hasura-role", options.Role)

			for key, value := range options.SessionVariables {
				header := key
				if !strings.HasPrefix(strings.ToLower(header), "x-hasura-") {
					header = "x-hasura-" + header
				}

				setHeader(header, value)
			}

			return next.RoundTrip(out)
		})
	}
}
