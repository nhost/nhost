// Package middleware extracts a Hasura-style session (role + session variables)
// from each HTTP request. The precedence is admin secret → JWT → public-role
// fallback. The extracted session is stored on the request context for later
// stages and exposed via SessionFromContext.
package middleware

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

// JWTAuthenticator abstracts JWT authentication so callers can mock it in tests.
//
//go:generate mockgen -package mock -destination mock/jwt_authenticator.go . JWTAuthenticator
type JWTAuthenticator interface {
	Authenticate(headers http.Header, roleOverride string) (*jwt.SessionResult, error)
}

// noOpJWTAuthenticator implements JWTAuthenticator by always returning
// (nil, nil), meaning no token was found. Useful when JWT auth is disabled.
type noOpJWTAuthenticator struct{}

func (noOpJWTAuthenticator) Authenticate(http.Header, string) (*jwt.SessionResult, error) {
	return nil, nil //nolint:nilnil // (nil, nil) is the documented "no token found" signal of JWTAuthenticator
}

// NewNoOpJWTAuthenticator returns a JWTAuthenticator that never finds a token.
// Use this when JWT authentication is disabled and callers should fall through
// to the public role.
//
// concrete type is unexported; callers consume only the interface.
func NewNoOpJWTAuthenticator() JWTAuthenticator { //nolint:ireturn,nolintlint
	return noOpJWTAuthenticator{}
}

type sessionCtxKey struct{}

// SessionVariables carries the resolved role and the Hasura session variables
// for the current request. The "x-hasura-role" key in Variables always matches
// Role; downstream code can rely on either.
type SessionVariables struct {
	Role      string
	Variables map[string]any
}

const (
	sessionHeaderAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec // header name, not a secret value
	sessionHeaderRole        = "X-Hasura-Role"
	sessionVariablesPrefix   = "X-Hasura-"

	publicRole = "public"
	adminRole  = "admin"
)

// SessionFromContext returns the SessionVariables previously stored on ctx by
// the Session middleware, or nil if none is set.
func SessionFromContext(ctx context.Context) *SessionVariables {
	session, ok := ctx.Value(sessionCtxKey{}).(*SessionVariables)
	if !ok {
		return nil
	}

	return session
}

func sessionToContext(ctx context.Context, session *SessionVariables) context.Context {
	return context.WithValue(ctx, sessionCtxKey{}, session)
}

// ExtractSession resolves a session from the request headers using the
// precedence admin-secret → JWT → public-role. Returns an error only when JWT
// authentication itself fails; an unrecognised request falls through to the
// public role.
func ExtractSession(
	adminSecret string,
	jwtAuth JWTAuthenticator,
	headers http.Header,
) (*SessionVariables, error) {
	// Constant-time comparison avoids leaking how many leading bytes of the
	// admin secret a caller guessed correctly. The explicit empty-secret guard
	// is kept so an unset admin secret never authenticates an absent or empty
	// header (ConstantTimeCompare("", "") would otherwise return 1).
	if adminSecret != "" &&
		subtle.ConstantTimeCompare(
			[]byte(adminSecret),
			[]byte(headers.Get(sessionHeaderAdminSecret)),
		) == 1 {
		return extractAdminSession(headers), nil
	}

	roleOverride := headers.Get(sessionHeaderRole)

	result, err := jwtAuth.Authenticate(headers, roleOverride)
	if err != nil {
		return nil, fmt.Errorf("jwt authentication: %w", err)
	}

	if result != nil {
		return &SessionVariables{
			Role:      result.Role,
			Variables: result.Variables,
		}, nil
	}

	return &SessionVariables{
		Role:      publicRole,
		Variables: map[string]any{"x-hasura-role": publicRole},
	}, nil
}

func extractAdminSession(headers http.Header) *SessionVariables {
	role := adminRole

	r := headers.Get(sessionHeaderRole)
	if r != "" {
		role = r
	}

	variables := make(map[string]any)

	for key, values := range headers {
		if strings.HasPrefix(key, sessionVariablesPrefix) && len(values) > 0 &&
			key != sessionHeaderAdminSecret &&
			key != sessionHeaderRole {
			variables[strings.ToLower(key)] = values[0]
		}
	}

	variables["x-hasura-role"] = role

	return &SessionVariables{
		Role:      role,
		Variables: variables,
	}
}

// Session returns a Gin middleware that calls ExtractSession on each request,
// stores the resolved SessionVariables on the request context, and aborts with
// HTTP 401 on JWT errors.
func Session(adminSecret string, jwtAuth JWTAuthenticator) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		logger := requestcontext.LoggerFromContext(ctx.Request.Context())

		session, err := ExtractSession(adminSecret, jwtAuth, ctx.Request.Header)
		if err != nil {
			logger.Error("jwt authentication failed", slog.String("error", err.Error()))
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "authentication failed"})
			ctx.Abort()

			return
		}

		logger = logger.With(
			slog.Group(
				"session",
				slog.String("role", session.Role),
			),
		)

		newCtx := sessionToContext(ctx.Request.Context(), session)
		newCtx = requestcontext.ClientHeadersToContext(newCtx, ctx.Request.Header.Clone())
		newCtx = requestcontext.LoggerToContext(newCtx, logger)

		ctx.Request = ctx.Request.WithContext(newCtx)

		ctx.Next()
	}
}
