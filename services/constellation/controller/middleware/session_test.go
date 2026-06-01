package middleware_test

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/middleware/mock"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
	"go.uber.org/mock/gomock"
)

const testHMACKey = "test-secret-key-for-session-tests"

func noOpAuthenticator() middleware.JWTAuthenticator {
	return middleware.NewNoOpJWTAuthenticator()
}

func testAuthenticator(t *testing.T) *jwt.Authenticator {
	t.Helper()

	cfg := jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{Type: jwtconfig.AlgorithmHS256, Key: testHMACKey},
		},
	}

	auth, err := jwt.NewAuthenticator(context.Background(), cfg, slog.Default())
	if err != nil {
		t.Fatalf("failed to create authenticator: %v", err)
	}

	t.Cleanup(auth.Close)

	return auth
}

func signToken(t *testing.T, claims gojwt.MapClaims) string {
	t.Helper()

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)

	tokenStr, err := token.SignedString([]byte(testHMACKey))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return tokenStr
}

func validJWTClaims() gojwt.MapClaims {
	return gojwt.MapClaims{
		"sub": "user-123",
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles": []any{"user", "editor"},
			"x-hasura-default-role":  "user",
			"x-hasura-user-id":       "123",
		},
	}
}

func toAnySlice(s []string) []any {
	result := make([]any, len(s))
	for i, v := range s {
		result[i] = v
	}

	return result
}

func TestExtractSession(t *testing.T) {
	t.Parallel()

	jwtAuth := testAuthenticator(t)

	cases := []struct {
		name        string
		adminSecret string
		jwtAuth     middleware.JWTAuthenticator
		headers     http.Header
		expected    *middleware.SessionVariables
		wantErr     bool
	}{
		{
			name:        "valid admin secret",
			adminSecret: "my-admin-secret",
			jwtAuth:     noOpAuthenticator(),
			headers: http.Header{
				"X-Hasura-Admin-Secret": {"my-admin-secret"},
			},
			expected: &middleware.SessionVariables{
				Role:      "admin",
				Variables: map[string]any{"x-hasura-role": "admin"},
			},
		},
		{
			name:        "admin secret with role override",
			adminSecret: "my-admin-secret",
			jwtAuth:     noOpAuthenticator(),
			headers: http.Header{
				"X-Hasura-Admin-Secret": {"my-admin-secret"},
				"X-Hasura-Role":         {"editor"},
			},
			expected: &middleware.SessionVariables{
				Role:      "editor",
				Variables: map[string]any{"x-hasura-role": "editor"},
			},
		},
		{
			name:        "admin secret with extra session variables",
			adminSecret: "my-admin-secret",
			jwtAuth:     noOpAuthenticator(),
			headers: http.Header{
				"X-Hasura-Admin-Secret": {"my-admin-secret"},
				"X-Hasura-User-Id":      {"user-456"},
			},
			expected: &middleware.SessionVariables{
				Role: "admin",
				Variables: map[string]any{
					"x-hasura-role":    "admin",
					"x-hasura-user-id": "user-456",
				},
			},
		},
		{
			name:        "invalid admin secret",
			adminSecret: "my-admin-secret",
			jwtAuth:     noOpAuthenticator(),
			headers: http.Header{
				"X-Hasura-Admin-Secret": {"wrong-secret"},
			},
			expected: &middleware.SessionVariables{
				Role:      "public",
				Variables: map[string]any{"x-hasura-role": "public"},
			},
		},
		{
			name:        "empty admin secret does not match empty header",
			adminSecret: "",
			jwtAuth:     noOpAuthenticator(),
			headers:     http.Header{},
			expected: &middleware.SessionVariables{
				Role:      "public",
				Variables: map[string]any{"x-hasura-role": "public"},
			},
		},
		{
			name:        "empty admin secret does not match empty header value",
			adminSecret: "",
			jwtAuth:     noOpAuthenticator(),
			headers: http.Header{
				"X-Hasura-Admin-Secret": {""},
			},
			expected: &middleware.SessionVariables{
				Role:      "public",
				Variables: map[string]any{"x-hasura-role": "public"},
			},
		},
		{
			name:        "jwt success",
			adminSecret: "",
			jwtAuth:     jwtAuth,
			headers: http.Header{
				"Authorization": {"Bearer " + signToken(t, validJWTClaims())},
			},
			expected: &middleware.SessionVariables{
				Role: "user",
				Variables: map[string]any{
					"x-hasura-role":          "user",
					"x-hasura-allowed-roles": toAnySlice([]string{"user", "editor"}),
					"x-hasura-default-role":  "user",
					"x-hasura-user-id":       "123",
				},
			},
		},
		{
			name:        "jwt with role override",
			adminSecret: "",
			jwtAuth:     jwtAuth,
			headers: http.Header{
				"Authorization": {"Bearer " + signToken(t, validJWTClaims())},
				"X-Hasura-Role": {"editor"},
			},
			expected: &middleware.SessionVariables{
				Role: "editor",
				Variables: map[string]any{
					"x-hasura-role":          "editor",
					"x-hasura-allowed-roles": toAnySlice([]string{"user", "editor"}),
					"x-hasura-default-role":  "user",
					"x-hasura-user-id":       "123",
				},
			},
		},
		{
			name:        "jwt failure returns error",
			adminSecret: "",
			jwtAuth:     jwtAuth,
			headers: http.Header{
				"Authorization": {"Bearer invalid.token.here"},
			},
			wantErr: true,
		},
		{
			name:        "jwt with expired token returns error",
			adminSecret: "",
			jwtAuth:     jwtAuth,
			headers: http.Header{
				"Authorization": {"Bearer " + signToken(t, gojwt.MapClaims{
					"sub": "user-123",
					"exp": gojwt.NewNumericDate(time.Now().Add(-time.Hour)),
					"https://hasura.io/jwt/claims": map[string]any{
						"x-hasura-allowed-roles": []any{"user"},
						"x-hasura-default-role":  "user",
					},
				})},
			},
			wantErr: true,
		},
		{
			name:        "admin secret takes precedence over jwt",
			adminSecret: "my-admin-secret",
			jwtAuth:     jwtAuth,
			headers: http.Header{
				"X-Hasura-Admin-Secret": {"my-admin-secret"},
				"Authorization":         {"Bearer " + signToken(t, validJWTClaims())},
			},
			expected: &middleware.SessionVariables{
				Role:      "admin",
				Variables: map[string]any{"x-hasura-role": "admin"},
			},
		},
		{
			name:        "no credentials falls through to public",
			adminSecret: "my-admin-secret",
			jwtAuth:     jwtAuth,
			headers:     http.Header{},
			expected: &middleware.SessionVariables{
				Role:      "public",
				Variables: map[string]any{"x-hasura-role": "public"},
			},
		},
		{
			name:        "nil jwt auth falls through to public",
			adminSecret: "",
			jwtAuth:     noOpAuthenticator(),
			headers:     http.Header{},
			expected: &middleware.SessionVariables{
				Role:      "public",
				Variables: map[string]any{"x-hasura-role": "public"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			session, err := middleware.ExtractSession(tc.adminSecret, tc.jwtAuth, tc.headers)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(
				tc.expected,
				session,
				cmpopts.IgnoreFields(middleware.SessionVariables{}, "ExpiresAt"),
			); diff != "" {
				t.Errorf("session mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestExtractSessionJWTExpiration(t *testing.T) {
	t.Parallel()

	jwtAuth := testAuthenticator(t)
	expiresAt := time.Unix(1893456000, 0).UTC()
	claims := validJWTClaims()
	claims["exp"] = gojwt.NewNumericDate(expiresAt)

	session, err := middleware.ExtractSession("", jwtAuth, http.Header{
		"Authorization": {"Bearer " + signToken(t, claims)},
	})
	if err != nil {
		t.Fatalf("ExtractSession() error = %v", err)
	}

	if session.ExpiresAt == nil {
		t.Fatal("expected JWT expiration to be propagated")
	}

	if !session.ExpiresAt.Equal(expiresAt) {
		t.Fatalf("expiration mismatch: want %s, got %s", expiresAt, *session.ExpiresAt)
	}
}

func TestNoOpJWTAuthenticator_Authenticate(t *testing.T) {
	t.Parallel()

	auth := middleware.NewNoOpJWTAuthenticator()

	result, err := auth.Authenticate(http.Header{
		"Authorization": {"Bearer anything"},
	}, "editor")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result != nil {
		t.Errorf("expected nil result, got %+v", result)
	}
}

func TestExtractSessionWithMockJWT(t *testing.T) {
	t.Parallel()

	t.Run("wraps authenticator error with context", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		auth := mock.NewMockJWTAuthenticator(ctrl)

		//nolint:err113 // test sentinel error used to verify error propagation
		sentinel := errors.New("token signature invalid")
		auth.EXPECT().
			AuthenticateWithExpiration(gomock.Any(), "").
			Return(nil, nil, sentinel)

		_, err := middleware.ExtractSession("", auth, http.Header{
			"Authorization": {"Bearer something"},
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		if !errors.Is(err, sentinel) {
			t.Fatalf("expected wrapped sentinel, got %v", err)
		}

		const wantPrefix = "jwt authentication: "
		if got := err.Error(); len(got) < len(wantPrefix) || got[:len(wantPrefix)] != wantPrefix {
			t.Errorf("expected message prefixed with %q, got %q", wantPrefix, got)
		}
	})

	t.Run("forwards authenticator result and role override", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		auth := mock.NewMockJWTAuthenticator(ctrl)

		expiresAt := time.Unix(1893456000, 0).UTC()
		auth.EXPECT().
			AuthenticateWithExpiration(gomock.Any(), "editor").
			Return(&jwt.SessionResult{
				Role: "editor",
				Variables: map[string]any{
					"x-hasura-role":    "editor",
					"x-hasura-user-id": "u-7",
				},
			}, &expiresAt, nil)

		session, err := middleware.ExtractSession("", auth, http.Header{
			"Authorization": {"Bearer signed"},
			"X-Hasura-Role": {"editor"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := &middleware.SessionVariables{
			Role: "editor",
			Variables: map[string]any{
				"x-hasura-role":    "editor",
				"x-hasura-user-id": "u-7",
			},
			ExpiresAt: &expiresAt,
		}
		if diff := cmp.Diff(want, session); diff != "" {
			t.Errorf("session mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("nil result falls through to public role", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		auth := mock.NewMockJWTAuthenticator(ctrl)

		auth.EXPECT().
			AuthenticateWithExpiration(gomock.Any(), "").
			Return(nil, nil, nil)

		session, err := middleware.ExtractSession("", auth, http.Header{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := &middleware.SessionVariables{
			Role:      "public",
			Variables: map[string]any{"x-hasura-role": "public"},
		}
		if diff := cmp.Diff(want, session); diff != "" {
			t.Errorf("session mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestSessionMiddleware(t *testing.T) {
	t.Parallel()

	jwtAuth := testAuthenticator(t)

	t.Run("success sets session in context", func(t *testing.T) {
		t.Parallel()

		gin.SetMode(gin.TestMode)

		router := gin.New()
		router.Use(middleware.Session("admin-secret", jwtAuth))
		router.GET("/test", func(ctx *gin.Context) {
			session := middleware.SessionFromContext(ctx.Request.Context())
			if session == nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no session"})

				return
			}

			ctx.JSON(http.StatusOK, gin.H{"role": session.Role})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("X-Hasura-Admin-Secret", "admin-secret")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("jwt failure returns 401", func(t *testing.T) {
		t.Parallel()

		gin.SetMode(gin.TestMode)

		router := gin.New()
		router.Use(middleware.Session("admin-secret", jwtAuth))
		router.GET("/test", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{"ok": true})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.value")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no credentials returns 200 with public role", func(t *testing.T) {
		t.Parallel()

		gin.SetMode(gin.TestMode)

		router := gin.New()
		router.Use(middleware.Session("admin-secret", jwtAuth))
		router.GET("/test", func(ctx *gin.Context) {
			session := middleware.SessionFromContext(ctx.Request.Context())
			if session == nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "no session"})

				return
			}

			ctx.JSON(http.StatusOK, gin.H{"role": session.Role})
		})

		req := httptest.NewRequest(http.MethodGet, "/test", nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}
