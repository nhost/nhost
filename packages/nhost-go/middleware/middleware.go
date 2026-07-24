// Package middleware provides the fetch chain functions that implement session
// refresh, access-token attachment, session capture, and role/header/admin
// injection. It mirrors @nhost/nhost-js's fetch middleware set.
package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/fetch"
	"github.com/nhost/nhost/packages/nhost-go/session"
)

// DefaultMarginSeconds is the default number of seconds before expiry at which
// the session-refresh middleware refreshes the access token.
const DefaultMarginSeconds = 60

// AttachAccessToken attaches "Authorization: Bearer <access_token>" from the
// stored session. It should run after the refresh middleware so the freshest
// token is used, and skips requests that already carry an Authorization header.
func AttachAccessToken(storage *session.Storage) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("Authorization") == "" {
				if s, ok := storage.Get(); ok && s.AccessToken != "" {
					req.Header.Set("Authorization", "Bearer "+s.AccessToken)
				}
			}

			return next(req)
		}
	}
}

// SessionRefresh refreshes the session before a request when the token is near
// expiry. It skips requests that already carry an Authorization header and the
// token endpoint itself (to avoid recursively refreshing during a refresh).
func SessionRefresh(
	authClient *auth.Client,
	storage *session.Storage,
	marginSeconds int,
) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("Authorization") == "" && !strings.HasSuffix(req.URL.Path, "/v1/token") {
				if _, err := session.RefreshSession(
					req.Context(), authClient, storage, marginSeconds,
				); err != nil {
					slog.Debug("session refresh failed; continuing", "error", err)
				}
			}

			return next(req)
		}
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

// UpdateSessionFromResponse persists session data returned by auth endpoints
// and clears it on sign-out. It reads and then restores the response body so
// downstream decoding still works.
func UpdateSessionFromResponse(storage *session.Storage) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			resp, err := next(req)
			if err != nil {
				return resp, err
			}

			path := req.URL.Path

			switch {
			case strings.HasSuffix(path, "/signout"):
				storage.Remove()

				return resp, nil
			case strings.HasSuffix(path, "/user/password") && resp.StatusCode < 300:
				storage.Remove()

				return resp, nil
			case strings.HasSuffix(path, "/token"),
				strings.Contains(path, "/token/exchange"),
				strings.Contains(path, "/signin/"),
				strings.Contains(path, "/signup/"):
				data, readErr := io.ReadAll(resp.Body)
				_ = resp.Body.Close()
				resp.Body = io.NopCloser(bytes.NewReader(data))

				if readErr == nil && len(data) > 0 {
					if s := extractSession(data); s != nil && s.AccessToken != "" && s.RefreshToken != "" {
						if setErr := storage.Set(*s); setErr != nil {
							slog.Warn("error storing session from response", "error", setErr)
						}
					}
				}
			}

			return resp, nil
		}
	}
}

// WithRole sets x-hasura-role on requests that don't already specify it.
func WithRole(role string) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("x-hasura-role") == "" {
				req.Header.Set("x-hasura-role", role)
			}

			return next(req)
		}
	}
}

// WithHeaders attaches default headers, preserving any request-specific values.
func WithHeaders(defaultHeaders map[string]string) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			for key, value := range defaultHeaders {
				if req.Header.Get(key) == "" {
					req.Header.Set(key, value)
				}
			}

			return next(req)
		}
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
}

// WithAdminSession attaches x-hasura-admin-secret and optional role/session
// variables.
func WithAdminSession(options AdminSessionOptions) fetch.ChainFunction {
	return func(next fetch.FetchFunc) fetch.FetchFunc {
		return func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("x-hasura-admin-secret") == "" {
				req.Header.Set("x-hasura-admin-secret", options.AdminSecret)
			}

			if options.Role != "" && req.Header.Get("x-hasura-role") == "" {
				req.Header.Set("x-hasura-role", options.Role)
			}

			for key, value := range options.SessionVariables {
				header := key
				if !strings.HasPrefix(header, "x-hasura-") {
					header = "x-hasura-" + header
				}

				if req.Header.Get(header) == "" {
					req.Header.Set(header, value)
				}
			}

			return next(req)
		}
	}
}
