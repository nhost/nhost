package jwt_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	json "encoding/json/v2"
	"encoding/pem"
	"errors"
	"log/slog"
	"maps"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jwt"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// hasuraClaims is a helper to build standard Hasura claims.
func hasuraClaims(roles []string, defaultRole string, extra map[string]any) map[string]any {
	claims := map[string]any{
		"x-hasura-allowed-roles": toAnySlice(roles),
		"x-hasura-default-role":  defaultRole,
	}
	maps.Copy(claims, extra)

	return claims
}

func toAnySlice(s []string) []any {
	result := make([]any, len(s))
	for i, v := range s {
		result[i] = v
	}

	return result
}

// expectedVars builds the expected session variables map from Hasura claims.
// Only Hasura namespace claims end up in session variables, not top-level JWT claims.
func expectedVars(
	role string,
	allowedRoles []string,
	defaultRole string,
	extra map[string]any,
) map[string]any {
	vars := map[string]any{
		"x-hasura-role":          role,
		"x-hasura-allowed-roles": toAnySlice(allowedRoles),
		"x-hasura-default-role":  defaultRole,
	}
	maps.Copy(vars, extra)

	return vars
}

func TestAuthenticator(t *testing.T) { //nolint:maintidx
	t.Parallel()

	rsaPrivKey, rsaPubPEM := generateRSAKeyPair(t)

	cases := []struct {
		name            string
		config          jwtconfig.Config
		headersFn       func(t *testing.T) http.Header
		roleOverride    string
		expectedSession *jwt.SessionResult
		wantErr         bool
	}{
		// --- Algorithm variants ---
		{
			name: "hs256 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "test-key"},
				},
			},
			headersFn: bearerTokenFn("test-key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"sub": "user-123",
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user", "editor"}, "user",
					map[string]any{"x-hasura-user-id": "123"},
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user", "editor"}, "user",
					map[string]any{"x-hasura-user-id": "123"}),
			},
		},
		{
			name: "rs256 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS256, Key: rsaPubPEM},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signRS256Token(t, rsaPrivKey, gojwt.MapClaims{
					"sub": "user-456",
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"admin"}, "admin", nil,
					),
				})

				return http.Header{"Authorization": {"Bearer " + token}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "admin",
				Variables: expectedVars("admin", []string{"admin"}, "admin", nil),
			},
		},

		// --- Signature failures ---
		{
			name: "hs256 - wrong signing key",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "correct-key"},
				},
			},
			headersFn: bearerTokenFn("wrong-key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"sub": "user-123",
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},
		{
			name: "hs256 - algorithm mismatch (token signed with RS256)",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "some-key"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signRS256Token(t, rsaPrivKey, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				return http.Header{"Authorization": {"Bearer " + token}}
			},
			wantErr: true,
		},

		// --- Expiration ---
		{
			name: "expired token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(-time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},
		{
			name: "missing exp claim",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},
		{
			name: "expired token within allowed skew",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key", AllowedSkew: new(uint(120))},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(-30 * time.Second)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},

		// --- Issuer validation ---
		{
			name: "issuer matches",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:   jwtconfig.AlgorithmHS256,
						Key:    "key",
						Issuer: "https://auth.example.com",
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"iss": "https://auth.example.com",
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "issuer mismatch",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:   jwtconfig.AlgorithmHS256,
						Key:    "key",
						Issuer: "https://auth.example.com",
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"iss": "https://other.example.com",
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},

		// --- Audience validation ---
		{
			name: "audience matches",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:     jwtconfig.AlgorithmHS256,
						Key:      "key",
						Audience: jwtconfig.StringOrList{"my-app"},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"aud": "my-app",
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "audience mismatch",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:     jwtconfig.AlgorithmHS256,
						Key:      "key",
						Audience: jwtconfig.StringOrList{"my-app"},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"aud": "other-app",
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},

		// --- No token / public fallthrough ---
		{
			name: "no token in headers - falls through to nil",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{}
			},
			expectedSession: nil,
		},
		{
			name: "authorization header with non-bearer scheme",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{"Authorization": {"Basic abc123"}}
			},
			expectedSession: nil,
		},
		{
			name: "bearer prefix case insensitive",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFnWithPrefix(
				"bearer ",
				"key",
				gojwt.SigningMethodHS256,
				gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				},
			),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},

		// --- Role override ---
		{
			name: "role override to allowed role",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user", "editor", "admin"}, "user", nil,
				),
			}),
			roleOverride: "editor",
			expectedSession: &jwt.SessionResult{
				Role:      "editor",
				Variables: expectedVars("editor", []string{"user", "editor", "admin"}, "user", nil),
			},
		},
		{
			name: "role override to disallowed role",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			roleOverride: "admin",
			wantErr:      true,
		},

		// --- Claims namespace variants ---
		{
			name: "custom claims namespace",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key", ClaimsNamespace: "custom-ns"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":       gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"custom-ns": hasuraClaims([]string{"user"}, "user", nil),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "claims namespace path with dollar prefix",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key", ClaimsNamespacePath: "$.app.auth"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"app": map[string]any{
					"auth": hasuraClaims([]string{"admin"}, "admin", nil),
				},
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "admin",
				Variables: expectedVars("admin", []string{"admin"}, "admin", nil),
			},
		},
		{
			name: "claims namespace not found in token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key", ClaimsNamespace: "missing-ns"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":       gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"other-key": "value",
			}),
			wantErr: true,
		},
		{
			name: "claims namespace path not found in token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:                jwtconfig.AlgorithmHS256,
						Key:                 "key",
						ClaimsNamespacePath: "$.nonexistent.path",
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"other": map[string]any{},
			}),
			wantErr: true,
		},

		// --- Claims format ---
		{
			name: "stringified json claims format",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:         jwtconfig.AlgorithmHS256,
						Key:          "key",
						ClaimsFormat: jwtconfig.ClaimsFormatStringifiedJSON,
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":                          gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": `{"x-hasura-allowed-roles":["user"],"x-hasura-default-role":"user","x-hasura-user-id":"42"}`,
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "42"}),
			},
		},
		{
			name: "stringified json claims format - not a string value",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:         jwtconfig.AlgorithmHS256,
						Key:          "key",
						ClaimsFormat: jwtconfig.ClaimsFormatStringifiedJSON,
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			wantErr: true,
		},

		// --- Missing required Hasura claims ---
		{
			name: "missing x-hasura-allowed-roles",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-default-role": "user",
				},
			}),
			wantErr: true,
		},
		{
			name: "missing x-hasura-default-role",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": []any{"user"},
				},
			}),
			wantErr: true,
		},

		// --- Header extraction variants ---
		{
			name: "cookie header extraction",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "cookie-key",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCookie,
								Name: "session",
							},
						},
					},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signHS256Token(t, "cookie-key", gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				return http.Header{"Cookie": {"session=" + token}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "cookie header - wrong cookie name falls through",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "cookie-key",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCookie,
								Name: "session",
							},
						},
					},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signHS256Token(t, "cookie-key", gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				return http.Header{"Cookie": {"other-cookie=" + token}}
			},
			expectedSession: nil,
		},
		{
			name: "custom header extraction",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "custom-key",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCustomHeader,
								Name: "X-My-Token",
							},
						},
					},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signHS256Token(t, "custom-key", gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				return http.Header{"X-My-Token": {token}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "custom header - header not present falls through",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "custom-key",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCustomHeader,
								Name: "X-My-Token",
							},
						},
					},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{}
			},
			expectedSession: nil,
		},

		// --- Multiple secrets ---
		{
			name: "multiple secrets - first matches",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key-1"},
					{Type: jwtconfig.AlgorithmHS256, Key: "key-2"},
				},
			},
			headersFn: bearerTokenFn("key-1", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "multiple secrets same header - second key verifies after first fails (fall-through)",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key-1"},
					{Type: jwtconfig.AlgorithmHS256, Key: "key-2"},
				},
			},
			headersFn: bearerTokenFn("key-2", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			// Both secrets read the Authorization header, so the first secret
			// extracts the token but fails signature verification with key-1.
			// Hasura's any-secret-validates contract requires falling through to
			// the second secret, which verifies the token with key-2.
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "multiple secrets same header - all keys fail returns error",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key-1"},
					{Type: jwtconfig.AlgorithmHS256, Key: "key-2"},
				},
			},
			headersFn: bearerTokenFn("key-3", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			// Token is signed with an unconfigured key (key-3): every secret
			// extracts it but none verifies it, so authentication fails 401.
			wantErr: true,
		},
		{
			name: "multiple secrets same header - verifying secret's extractor is used",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key-1", ClaimsNamespace: "ns-1"},
					{Type: jwtconfig.AlgorithmHS256, Key: "key-2", ClaimsNamespace: "ns-2"},
				},
			},
			headersFn: bearerTokenFn("key-2", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				// Claims live under the second secret's namespace. The first
				// secret extracts the token but fails verification; the second
				// secret verifies it AND its paired extractor (ns-2) must be the
				// one used to resolve claims.
				"ns-2": hasuraClaims([]string{"editor"}, "editor", nil),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "editor",
				Variables: expectedVars("editor", []string{"editor"}, "editor", nil),
			},
		},
		{
			name: "multiple secrets different headers - second matches via Authorization",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key-1",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCookie,
								Name: "jwt",
							},
						},
					},
					{Type: jwtconfig.AlgorithmHS256, Key: "key-2"},
				},
			},
			headersFn: bearerTokenFn("key-2", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			// First secret looks in cookie (not found), second looks in Authorization (found, valid)
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "multiple secrets - all miss returns nil",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key-1",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCookie,
								Name: "jwt",
							},
						},
					},
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key-2",
						Header: &jwtconfig.HeaderJSON{
							HeaderConfig: jwtconfig.HeaderConfig{
								Type: jwtconfig.HeaderTypeCustomHeader,
								Name: "X-Token",
							},
						},
					},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{"Authorization": {"Bearer something"}}
			},
			expectedSession: nil,
		},

		// --- RSA with kid ---
		{
			name: "rs256 with matching kid",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS256, Key: rsaPubPEM, Kid: "my-key-id"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})
				token.Header["kid"] = "my-key-id"

				tokenStr, err := token.SignedString(rsaPrivKey)
				if err != nil {
					t.Fatalf("failed to sign token: %v", err)
				}

				return http.Header{"Authorization": {"Bearer " + tokenStr}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "rs256 with kid mismatch",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS256, Key: rsaPubPEM, Kid: "expected-kid"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})
				token.Header["kid"] = "wrong-kid"

				tokenStr, err := token.SignedString(rsaPrivKey)
				if err != nil {
					t.Fatalf("failed to sign token: %v", err)
				}

				return http.Header{"Authorization": {"Bearer " + tokenStr}}
			},
			wantErr: true,
		},

		// --- Malformed tokens ---
		{
			name: "completely invalid token string",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{"Authorization": {"Bearer not-a-jwt-at-all"}}
			},
			wantErr: true,
		},
		{
			name: "empty bearer value",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				return http.Header{"Authorization": {"Bearer "}}
			},
			// Empty string after "Bearer " is still empty -> no token found
			expectedSession: nil,
		},

		// --- Session variable passthrough ---
		{
			name: "extra hasura claims are passed through as session variables",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user",
					map[string]any{
						"x-hasura-user-id": "uid-999",
						"x-hasura-org-id":  "org-42",
					},
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{
						"x-hasura-user-id": "uid-999",
						"x-hasura-org-id":  "org-42",
					}),
			},
		},
		{
			name: "non x-hasura claims inside namespace are dropped from session variables",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user",
					map[string]any{
						"x-hasura-user-id": "uid-7",
						// Non-x-hasura keys must not leak into session variables.
						"sub":           "subject-id",
						"foo":           "bar",
						"x-foo":         "evil",
						"admin_secret":  "should-not-appear",
						"x_hasura_user": "underscore-not-dash",
					},
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "uid-7"}),
			},
		},
		{
			name: "numeric x-hasura session variable claim is rejected (matches Hasura)",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user",
					// A non-conforming issuer emits a JSON number; golang-jwt
					// decodes it to float64. Hasura rejects this with
					// "x-hasura-* claims: parsing Text failed, expected String".
					map[string]any{"x-hasura-user-id": 42},
				),
			}),
			wantErr: true,
		},
		{
			name: "boolean x-hasura session variable claim is rejected (matches Hasura)",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user",
					map[string]any{"x-hasura-is-admin": true},
				),
			}),
			wantErr: true,
		},
		{
			name: "x-hasura claim with uppercase prefix is lowercased and kept",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user",
					map[string]any{
						"X-Hasura-User-Id": "mixed-case-id",
					},
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "mixed-case-id"}),
			},
		},
		{
			name: "claims_map keys without x-hasura prefix are dropped from session variables",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.sub"},
							// Operator misconfigures a key without the required prefix.
							// The validator must drop it rather than silently expose it
							// under an attacker-controlled name.
							"custom-claim": {Literal: "should-not-appear"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "user-1",
				"role":  "user",
				"roles": []string{"user"},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "user-1"}),
			},
		},

		// --- Additional algorithm variants ---
		{
			name: "hs384 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS384, Key: "test-key-384"},
				},
			},
			headersFn: bearerTokenFn("test-key-384", gojwt.SigningMethodHS384, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "hs512 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS512, Key: "test-key-512"},
				},
			},
			headersFn: bearerTokenFn("test-key-512", gojwt.SigningMethodHS512, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},
		{
			name: "rs384 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS384, Key: rsaPubPEM},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := gojwt.NewWithClaims(gojwt.SigningMethodRS384, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"admin"}, "admin", nil,
					),
				})

				tokenStr, err := token.SignedString(rsaPrivKey)
				if err != nil {
					t.Fatalf("failed to sign token: %v", err)
				}

				return http.Header{"Authorization": {"Bearer " + tokenStr}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "admin",
				Variables: expectedVars("admin", []string{"admin"}, "admin", nil),
			},
		},
		{
			name: "rs512 - valid token",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS512, Key: rsaPubPEM},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := gojwt.NewWithClaims(gojwt.SigningMethodRS512, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				tokenStr, err := token.SignedString(rsaPrivKey)
				if err != nil {
					t.Fatalf("failed to sign token: %v", err)
				}

				return http.Header{"Authorization": {"Bearer " + tokenStr}}
			},
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},

		// --- HMAC key encoding ---
		{
			name: "hs256 - base64 encoded key",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "dGVzdA=="}, // base64("test")
				},
			},
			headersFn: bearerTokenFn("test", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": hasuraClaims(
					[]string{"user"}, "user", nil,
				),
			}),
			expectedSession: &jwt.SessionResult{
				Role:      "user",
				Variables: expectedVars("user", []string{"user"}, "user", nil),
			},
		},

		// --- Hasura claims type edge cases ---
		{
			name: "empty x-hasura-allowed-roles uses default role",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": []any{},
					"x-hasura-default-role":  "user",
				},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: map[string]any{
					"x-hasura-role":          "user",
					"x-hasura-allowed-roles": []any{},
					"x-hasura-default-role":  "user",
				},
			},
		},
		{
			name: "empty x-hasura-allowed-roles rejects role override",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": []any{},
					"x-hasura-default-role":  "user",
				},
			}),
			roleOverride: "admin",
			wantErr:      true,
		},
		{
			name: "x-hasura-allowed-roles is string not array",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": "user",
					"x-hasura-default-role":  "user",
				},
			}),
			wantErr: true,
		},
		{
			name: "x-hasura-default-role is not a string",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": []any{"user"},
					"x-hasura-default-role":  42,
				},
			}),
			wantErr: true,
		},
		{
			name: "null element in x-hasura-allowed-roles",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles": []any{"user", nil},
					"x-hasura-default-role":  "user",
				},
			}),
			wantErr: true,
		},

		// --- Claims namespace edge cases ---
		{
			name: "claims namespace value is a string not object",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: "key"},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":                          gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": "not-an-object",
			}),
			wantErr: true,
		},
		// --- Stringified JSON edge cases ---
		{
			name: "stringified json claims is a JSON array not object",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type:         jwtconfig.AlgorithmHS256,
						Key:          "key",
						ClaimsFormat: jwtconfig.ClaimsFormatStringifiedJSON,
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":                          gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"https://hasura.io/jwt/claims": `[1,2,3]`,
			}),
			wantErr: true,
		},

		// --- Kid edge cases ---
		{
			name: "rs256 - token missing kid when secret expects one",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmRS256, Key: rsaPubPEM, Kid: "expected-kid"},
				},
			},
			headersFn: func(t *testing.T) http.Header {
				t.Helper()

				token := signRS256Token(t, rsaPrivKey, gojwt.MapClaims{
					"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
					"https://hasura.io/jwt/claims": hasuraClaims(
						[]string{"user"}, "user", nil,
					),
				})

				return http.Header{"Authorization": {"Bearer " + token}}
			},
			wantErr: true,
		},

		// --- Claims map ---
		{
			name: "claims_map - basic path extraction",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "user-123",
				"role":  "user",
				"roles": []string{"user", "editor"},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user", "editor"}, "user",
					map[string]any{"x-hasura-user-id": "user-123"}),
			},
		},
		{
			name: "claims_map - path with default when path exists",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role", Default: "viewer"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "u-1",
				"role":  "admin",
				"roles": []string{"admin"},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "admin",
				Variables: expectedVars("admin", []string{"admin"}, "admin",
					map[string]any{"x-hasura-user-id": "u-1"}),
			},
		},
		{
			name: "claims_map - path with default when path missing",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.missing_role", Default: "viewer"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "u-2",
				"roles": []string{"viewer"},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "viewer",
				Variables: expectedVars("viewer", []string{"viewer"}, "viewer",
					map[string]any{"x-hasura-user-id": "u-2"}),
			},
		},
		{
			name: "claims_map - literal string value",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Literal: "user"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "u-3",
				"roles": []string{"user"},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "u-3"}),
			},
		},
		{
			name: "claims_map - literal array value",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Literal: []any{"user", "editor"}},
							"x-hasura-default-role":  {Literal: "user"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub": "u-4",
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user", "editor"}, "user",
					map[string]any{"x-hasura-user-id": "u-4"}),
			},
		},
		{
			name: "claims_map - nested path extraction",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.user.profile.id"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"role":  "user",
				"roles": []string{"user"},
				"user": map[string]any{
					"profile": map[string]any{
						"id": "nested-id",
					},
				},
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{"x-hasura-user-id": "nested-id"}),
			},
		},
		{
			name: "claims_map - path not found with no default",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.nonexistent"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"role":  "user",
				"roles": []string{"user"},
			}),
			wantErr: true,
		},
		{
			name: "claims_map - missing required claims in map",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-user-id": {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub": "u-5",
			}),
			wantErr: true,
		},
		{
			name: "claims_map - role override works",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.sub"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "u-6",
				"role":  "user",
				"roles": []string{"user", "admin"},
			}),
			roleOverride: "admin",
			expectedSession: &jwt.SessionResult{
				Role: "admin",
				Variables: expectedVars("admin", []string{"user", "admin"}, "user",
					map[string]any{"x-hasura-user-id": "u-6"}),
			},
		},
		{
			name: "claims_map - extra session variables pass through",
			config: jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{
						Type: jwtconfig.AlgorithmHS256,
						Key:  "key",
						ClaimsMap: jwtconfig.ClaimsMap{
							"x-hasura-allowed-roles": {Path: "$.roles"},
							"x-hasura-default-role":  {Path: "$.role"},
							"x-hasura-user-id":       {Path: "$.sub"},
							"x-hasura-org-id":        {Path: "$.org"},
						},
					},
				},
			},
			headersFn: bearerTokenFn("key", gojwt.SigningMethodHS256, gojwt.MapClaims{
				"exp":   gojwt.NewNumericDate(time.Now().Add(time.Hour)),
				"sub":   "u-7",
				"role":  "user",
				"roles": []string{"user"},
				"org":   "org-42",
			}),
			expectedSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars("user", []string{"user"}, "user",
					map[string]any{
						"x-hasura-user-id": "u-7",
						"x-hasura-org-id":  "org-42",
					}),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			auth, err := jwt.NewAuthenticator(context.Background(), tc.config, slog.Default())
			if err != nil {
				t.Fatalf("NewAuthenticator() error = %v", err)
			}
			defer auth.Close()

			headers := tc.headersFn(t)

			result, err := auth.Authenticate(headers, tc.roleOverride)

			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil (result=%+v)", result)
				}

				if result != nil {
					t.Errorf("expected nil result on error, got %+v", result)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expectedSession, result); diff != "" {
				t.Errorf("session mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestAuthenticatorAuthenticateWithExpiration(t *testing.T) {
	t.Parallel()

	const hmacKey = "expiry-test-key"

	expiresAt := gojwt.NewNumericDate(time.Now().Add(time.Hour).UTC()).Time

	validClaims := func(exp time.Time) gojwt.MapClaims {
		return gojwt.MapClaims{
			"sub": "user-123",
			"exp": gojwt.NewNumericDate(exp),
			"https://hasura.io/jwt/claims": hasuraClaims(
				[]string{"user"}, "user", map[string]any{"x-hasura-user-id": "123"},
			),
		}
	}

	cases := []struct {
		name string
		// headersFn builds the request headers; it receives the HMAC signing
		// key so cases that need a token can sign one inline.
		headersFn func(t *testing.T, key string) http.Header
		// wantSession is the expected session result; nil means none expected.
		wantSession *jwt.SessionResult
		// wantExpiration is the expected exp pointer target; nil means the
		// returned expiration pointer must itself be nil.
		wantExpiration *time.Time
		wantErr        bool
	}{
		{
			name: "valid token returns session and expiration",
			headersFn: func(t *testing.T, key string) http.Header {
				t.Helper()

				return http.Header{
					"Authorization": {"Bearer " + signHS256Token(t, key, validClaims(expiresAt))},
				}
			},
			wantSession: &jwt.SessionResult{
				Role: "user",
				Variables: expectedVars(
					"user", []string{"user"}, "user", map[string]any{"x-hasura-user-id": "123"},
				),
			},
			wantExpiration: &expiresAt,
			wantErr:        false,
		},
		{
			name: "no token returns nil session, nil expiration, nil error",
			headersFn: func(t *testing.T, _ string) http.Header {
				t.Helper()

				return http.Header{}
			},
			wantSession:    nil,
			wantExpiration: nil,
			wantErr:        false,
		},
		{
			name: "expired token returns nil session, nil expiration, error",
			headersFn: func(t *testing.T, key string) http.Header {
				t.Helper()

				expired := time.Unix(1000000000, 0).UTC()

				return http.Header{
					"Authorization": {"Bearer " + signHS256Token(t, key, validClaims(expired))},
				}
			},
			wantSession:    nil,
			wantExpiration: nil,
			wantErr:        true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
				Secrets: []jwtconfig.Secret{
					{Type: jwtconfig.AlgorithmHS256, Key: hmacKey},
				},
			}, slog.Default())
			if err != nil {
				t.Fatalf("NewAuthenticator() error = %v", err)
			}
			defer auth.Close()

			result, gotExpiresAt, err := auth.AuthenticateWithExpiration(
				tc.headersFn(t, hmacKey),
				"",
			)

			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil (result=%+v)", result)
				}
			} else if err != nil {
				t.Fatalf("AuthenticateWithExpiration() unexpected error = %v", err)
			}

			if diff := cmp.Diff(tc.wantSession, result); diff != "" {
				t.Errorf("session mismatch (-want +got):\n%s", diff)
			}

			switch {
			case tc.wantExpiration == nil && gotExpiresAt != nil:
				t.Errorf("expected nil expiration, got %s", *gotExpiresAt)
			case tc.wantExpiration != nil && gotExpiresAt == nil:
				t.Error("expected expiration to be returned, got nil")
			case tc.wantExpiration != nil && !gotExpiresAt.Equal(*tc.wantExpiration):
				t.Errorf("expiration mismatch: want %s, got %s", *tc.wantExpiration, *gotExpiresAt)
			}
		})
	}
}

func TestNewAuthenticatorErrorForEmptyConfig(t *testing.T) {
	t.Parallel()

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{}, slog.Default())
	if err == nil {
		t.Fatal("expected error for empty config")
	}

	if !errors.Is(err, jwt.ErrNoSecrets) {
		t.Errorf("expected error to wrap jwt.ErrNoSecrets, got %v", err)
	}

	if auth != nil {
		t.Error("expected nil authenticator when error is returned")
	}
}

func TestNewAuthenticatorInvalidPEM(t *testing.T) {
	t.Parallel()

	_, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{Type: jwtconfig.AlgorithmRS256, Key: "not-a-valid-pem"},
		},
	}, slog.Default())
	if err == nil {
		t.Error("expected error for invalid PEM key, got nil")
	}
}

func TestNewAuthenticatorPKCS1Key(t *testing.T) {
	t.Parallel()

	privKey, _ := generateRSAKeyPair(t)

	// Re-encode the public key in PKCS1 format (RSA PUBLIC KEY) instead of PKIX (PUBLIC KEY).
	pkcs1Bytes := x509.MarshalPKCS1PublicKey(&privKey.PublicKey)
	pkcs1PEM := string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: pkcs1Bytes,
	}))

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{Type: jwtconfig.AlgorithmRS256, Key: pkcs1PEM},
		},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() with PKCS1 key error = %v", err)
	}
	defer auth.Close()

	tokenStr := signRS256Token(t, privKey, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", nil,
		),
	})

	result, err := auth.Authenticate(http.Header{"Authorization": {"Bearer " + tokenStr}}, "")
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}

	if result == nil || result.Role != "user" {
		t.Errorf("expected role=user, got %+v", result)
	}
}

func generateRSAKeyPair(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	pubDER, err := x509.MarshalPKIXPublicKey(&privKey.PublicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}

	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:    "PUBLIC KEY",
		Headers: nil,
		Bytes:   pubDER,
	})

	return privKey, string(pubPEM)
}

func signHS256Token(t *testing.T, key string, claims gojwt.MapClaims) string {
	t.Helper()

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)

	tokenStr, err := token.SignedString([]byte(key))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return tokenStr
}

func signRS256Token(t *testing.T, privKey *rsa.PrivateKey, claims gojwt.MapClaims) string {
	t.Helper()

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)

	tokenStr, err := token.SignedString(privKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return tokenStr
}

// bearerTokenFn returns a headersFn that signs a token with the given HMAC key and method
// and places it in an Authorization: Bearer header.
func bearerTokenFn(
	key string,
	method gojwt.SigningMethod,
	claims gojwt.MapClaims,
) func(*testing.T) http.Header {
	return bearerTokenFnWithPrefix("Bearer ", key, method, claims)
}

// bearerTokenFnWithPrefix is like bearerTokenFn but allows a custom prefix (e.g. "bearer " for case-insensitive tests).
func bearerTokenFnWithPrefix(
	prefix, key string, method gojwt.SigningMethod, claims gojwt.MapClaims,
) func(*testing.T) http.Header {
	return func(t *testing.T) http.Header {
		t.Helper()

		token := gojwt.NewWithClaims(method, claims)

		tokenStr, err := token.SignedString([]byte(key))
		if err != nil {
			t.Fatalf("failed to sign token: %v", err)
		}

		return http.Header{"Authorization": {prefix + tokenStr}}
	}
}

// rsaPublicKeyToJWKS converts an RSA public key to a minimal JWKS JSON response.
func rsaPublicKeyToJWKS(t *testing.T, pub *rsa.PublicKey, kid string) []byte {
	t.Helper()

	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
	e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())

	jwks := map[string]any{
		"keys": []map[string]any{
			{
				"kty": "RSA",
				"alg": "RS256",
				"use": "sig",
				"kid": kid,
				"n":   n,
				"e":   e,
			},
		},
	}

	data, err := json.Marshal(jwks)
	if err != nil {
		t.Fatalf("failed to marshal JWKS: %v", err)
	}

	return data
}

// startJWKSServer starts an httptest server that serves a JWKS endpoint.
func startJWKSServer(t *testing.T, pub *rsa.PublicKey, kid string) *httptest.Server {
	t.Helper()

	jwksJSON := rsaPublicKeyToJWKS(t, pub, kid)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwksJSON)
	}))

	t.Cleanup(srv.Close)

	return srv
}

// signRS256WithKid signs a token with the given RSA private key and optional kid header.
func signRS256WithKid(
	t *testing.T,
	privKey *rsa.PrivateKey,
	kid string,
	claims gojwt.MapClaims,
) string {
	t.Helper()

	token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, claims)
	if kid != "" {
		token.Header["kid"] = kid
	}

	tokenStr, err := token.SignedString(privKey)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return tokenStr
}

func TestAuthenticatorJWKURLValidToken(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	kid := "test-kid-1"
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, kid)

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	tokenStr := signRS256WithKid(t, rsaPrivKey, kid, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", map[string]any{"x-hasura-user-id": "jwk-user"},
		),
	})

	result, err := auth.Authenticate(http.Header{"Authorization": {"Bearer " + tokenStr}}, "")
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}

	expected := &jwt.SessionResult{
		Role: "user",
		Variables: expectedVars("user", []string{"user"}, "user",
			map[string]any{"x-hasura-user-id": "jwk-user"}),
	}

	if diff := cmp.Diff(expected, result); diff != "" {
		t.Errorf("session mismatch (-want +got):\n%s", diff)
	}
}

func TestAuthenticatorJWKURLWithoutKid(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, "some-kid")

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	// Token without kid — keyfunc returns VerificationKeySet with all keys.
	tokenStr := signRS256WithKid(t, rsaPrivKey, "", gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"admin"}, "admin", nil,
		),
	})

	result, err := auth.Authenticate(http.Header{"Authorization": {"Bearer " + tokenStr}}, "")
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}

	if result == nil || result.Role != "admin" {
		t.Errorf("expected role=admin, got %+v", result)
	}
}

func TestAuthenticatorJWKURLWrongSigningKey(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	otherPrivKey, _ := generateRSAKeyPair(t)
	kid := "test-kid-wrong"
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, kid)

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	// Sign with a different key than what the JWKS server provides.
	tokenStr := signRS256WithKid(t, otherPrivKey, kid, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", nil,
		),
	})

	result, authErr := auth.Authenticate(http.Header{"Authorization": {"Bearer " + tokenStr}}, "")
	if authErr == nil {
		t.Error("expected error for wrong signing key, got nil")
	}

	if result != nil {
		t.Errorf("expected nil result, got %+v", result)
	}
}

func TestAuthenticatorJWKURLUnknownKid(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, "known-kid")

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	tokenStr := signRS256WithKid(t, rsaPrivKey, "nonexistent-kid", gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", nil,
		),
	})

	result, authErr := auth.Authenticate(http.Header{"Authorization": {"Bearer " + tokenStr}}, "")
	if authErr == nil {
		t.Error("expected error for unknown kid, got nil")
	}

	if result != nil {
		t.Errorf("expected nil result, got %+v", result)
	}
}

// TestAuthenticatorJWKURLRejectsHS256 asserts that a JWKS-backed secret pins an
// asymmetric (RS*) algorithm allowlist at the parser layer, so a token signed
// with a symmetric algorithm (HS256) — the classic algorithm-confusion attempt
// where the attacker signs with the public key bytes as an HMAC secret — is
// rejected before key resolution. This mirrors the allowlist the static-key
// path already pins via WithValidMethods.
func TestAuthenticatorJWKURLRejectsHS256(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	kid := "hs-confusion-kid"
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, kid)

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	// Sign with HS256 (symmetric). Even with a kid header set, the parser-level
	// algorithm allowlist must reject the token because HS256 is not in the
	// JWKS allowlist.
	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", nil,
		),
	})
	token.Header["kid"] = kid

	tokenStr, signErr := token.SignedString([]byte("attacker-hmac-secret"))
	if signErr != nil {
		t.Fatalf("failed to sign HS256 token: %v", signErr)
	}

	result, authErr := auth.Authenticate(
		http.Header{"Authorization": {"Bearer " + tokenStr}}, "",
	)
	if authErr == nil {
		t.Error("expected error for HS256 token against JWKS secret, got nil")
	}

	if result != nil {
		t.Errorf("expected nil result, got %+v", result)
	}
}

func TestAuthenticatorJWKURLWithIssuerAndAudience(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	kid := "iss-aud-kid"
	srv := startJWKSServer(t, &rsaPrivKey.PublicKey, kid)

	cfg := jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{
				JWKURL:   srv.URL,
				Issuer:   "https://auth.example.com",
				Audience: jwtconfig.StringOrList{"my-app"},
			},
		},
	}

	auth, err := jwt.NewAuthenticator(context.Background(), cfg, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}
	defer auth.Close()

	t.Run("valid issuer and audience", func(t *testing.T) {
		t.Parallel()

		token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, gojwt.MapClaims{
			"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
			"iss": "https://auth.example.com",
			"aud": "my-app",
			"https://hasura.io/jwt/claims": hasuraClaims(
				[]string{"user"}, "user", nil,
			),
		})
		token.Header["kid"] = kid

		tokenStr, signErr := token.SignedString(rsaPrivKey)
		if signErr != nil {
			t.Fatalf("failed to sign token: %v", signErr)
		}

		result, authErr := auth.Authenticate(
			http.Header{"Authorization": {"Bearer " + tokenStr}}, "",
		)
		if authErr != nil {
			t.Fatalf("Authenticate() error = %v", authErr)
		}

		if result == nil || result.Role != "user" {
			t.Errorf("expected role=user, got %+v", result)
		}
	})

	t.Run("wrong issuer rejected", func(t *testing.T) {
		t.Parallel()

		token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, gojwt.MapClaims{
			"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
			"iss": "https://wrong.example.com",
			"aud": "my-app",
			"https://hasura.io/jwt/claims": hasuraClaims(
				[]string{"user"}, "user", nil,
			),
		})
		token.Header["kid"] = kid

		tokenStr, signErr := token.SignedString(rsaPrivKey)
		if signErr != nil {
			t.Fatalf("failed to sign token: %v", signErr)
		}

		result, authErr := auth.Authenticate(
			http.Header{"Authorization": {"Bearer " + tokenStr}}, "",
		)
		if authErr == nil {
			t.Error("expected error for wrong issuer")
		}

		if result != nil {
			t.Errorf("expected nil result, got %+v", result)
		}
	})

	t.Run("wrong audience rejected", func(t *testing.T) {
		t.Parallel()

		token := gojwt.NewWithClaims(gojwt.SigningMethodRS256, gojwt.MapClaims{
			"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
			"iss": "https://auth.example.com",
			"aud": "wrong-app",
			"https://hasura.io/jwt/claims": hasuraClaims(
				[]string{"user"}, "user", nil,
			),
		})
		token.Header["kid"] = kid

		tokenStr, signErr := token.SignedString(rsaPrivKey)
		if signErr != nil {
			t.Fatalf("failed to sign token: %v", signErr)
		}

		result, authErr := auth.Authenticate(
			http.Header{"Authorization": {"Bearer " + tokenStr}}, "",
		)
		if authErr == nil {
			t.Error("expected error for wrong audience")
		}

		if result != nil {
			t.Errorf("expected nil result, got %+v", result)
		}
	})
}

// countingJWKSServer wraps an httptest.Server with an atomic counter so a
// test can assert whether Close() actually stops the JWKS refresh goroutine
// from hitting the network.
type countingJWKSServer struct {
	srv  *httptest.Server
	hits atomic.Int64
}

func startCountingJWKSServer(t *testing.T, pub *rsa.PublicKey, kid string) *countingJWKSServer {
	t.Helper()

	jwksJSON := rsaPublicKeyToJWKS(t, pub, kid)
	cs := &countingJWKSServer{srv: nil, hits: atomic.Int64{}}

	cs.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		cs.hits.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwksJSON)
	}))

	t.Cleanup(cs.srv.Close)

	return cs
}

// TestAuthenticatorCloseJWKSBacked exercises Authenticator.Close() on a
// JWKS-backed authenticator using a real httptest server. It asserts the
// observable behaviour spelled out in the package contract: the authenticator
// fetches JWKS while open, and Close() returns promptly and is idempotent.
// That Close() actually cancels the background refresh goroutine is verified
// directly in TestAuthenticatorCloseCancelsJWKSContext (which watches the
// provider's context); this black-box test deliberately does not re-assert it
// by timing, because keyfunc's hour-long default refresh interval means a
// short post-Close "hit count is stable" window can never fail and so proves
// nothing.
func TestAuthenticatorCloseJWKSBacked(t *testing.T) {
	t.Parallel()

	rsaPrivKey, _ := generateRSAKeyPair(t)
	kid := "close-test-kid"
	cs := startCountingJWKSServer(t, &rsaPrivKey.PublicKey, kid)

	auth, err := jwt.NewAuthenticator(context.Background(), jwtconfig.Config{
		Secrets: []jwtconfig.Secret{{JWKURL: cs.srv.URL}},
	}, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator() error = %v", err)
	}

	// Sanity-check: authenticator works while open. This also forces at
	// least one JWKS fetch, which the hit-count assertion below confirms.
	tokenStr := signRS256WithKid(t, rsaPrivKey, kid, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"https://hasura.io/jwt/claims": hasuraClaims(
			[]string{"user"}, "user", nil,
		),
	})

	result, authErr := auth.Authenticate(
		http.Header{"Authorization": {"Bearer " + tokenStr}}, "",
	)
	if authErr != nil {
		t.Fatalf("Authenticate before Close() error = %v", authErr)
	}

	if result == nil || result.Role != "user" {
		t.Fatalf("expected role=user before Close(), got %+v", result)
	}

	if cs.hits.Load() == 0 {
		t.Fatalf("expected at least one JWKS fetch before Close(), got 0")
	}

	// Close() must not panic and must return promptly.
	done := make(chan struct{})
	go func() {
		auth.Close()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Close() did not return within 1s")
	}

	// Close() must be safe to call a second time on a closed authenticator
	// (no panic, no further side effects on the upstream JWKS provider).
	auth.Close()
}

// TestConfigLiteralRoundTripsThroughNewAuthenticator asserts the documented
// promise of jwtconfig.Config: a hand-built `Config{Secrets: ...}` literal behaves
// identically to one returned by ParseConfig when both are passed to
// NewAuthenticator. The check is end-to-end (both authenticators accept the
// same valid token and produce equal SessionResult values) so any divergence
// in setup — extra normalisation by ParseConfig, default population, hidden
// validation — would surface as a behavioural diff.
func TestConfigLiteralRoundTripsThroughNewAuthenticator(t *testing.T) {
	t.Parallel()

	const (
		key       = "shared-hmac-secret"
		issuer    = "https://issuer.example.test"
		audience  = "round-trip-app"
		namespace = "https://hasura.io/jwt/claims"
	)

	allowedSkew := uint(30)

	rawJSON := `{` +
		`"type":"HS256",` +
		`"key":"` + key + `",` +
		`"issuer":"` + issuer + `",` +
		`"audience":"` + audience + `",` +
		`"allowed_skew":30,` +
		`"claims_namespace":"` + namespace + `"` +
		`}`

	parsedCfg, err := jwtconfig.ParseConfig([]string{rawJSON})
	if err != nil {
		t.Fatalf("ParseConfig() error = %v", err)
	}

	literalCfg := jwtconfig.Config{
		Secrets: []jwtconfig.Secret{
			{
				Type:                jwtconfig.AlgorithmHS256,
				Key:                 key,
				Kid:                 "",
				JWKURL:              "",
				ClaimsFormat:        "",
				ClaimsNamespace:     namespace,
				ClaimsNamespacePath: "",
				ClaimsMap:           nil,
				Audience:            jwtconfig.StringOrList{audience},
				Issuer:              issuer,
				AllowedSkew:         &allowedSkew,
				Header:              nil,
			},
		},
	}

	// Both configs must describe the same Secrets surface. We compare the
	// parsed and literal forms directly to guard against silent
	// post-parsing normalisation drift in ParseConfig.
	if diff := cmp.Diff(literalCfg, parsedCfg); diff != "" {
		t.Errorf("literal Config differs from ParseConfig output (-literal +parsed):\n%s", diff)
	}

	parsedAuth, err := jwt.NewAuthenticator(context.Background(), parsedCfg, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator(parsed) error = %v", err)
	}
	defer parsedAuth.Close()

	literalAuth, err := jwt.NewAuthenticator(context.Background(), literalCfg, slog.Default())
	if err != nil {
		t.Fatalf("NewAuthenticator(literal) error = %v", err)
	}
	defer literalAuth.Close()

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, gojwt.MapClaims{
		"exp": gojwt.NewNumericDate(time.Now().Add(time.Hour)),
		"iss": issuer,
		"aud": audience,
		namespace: hasuraClaims(
			[]string{"user"}, "user", map[string]any{"x-hasura-user-id": "rt-user"},
		),
	})

	tokenStr, err := token.SignedString([]byte(key))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	headers := http.Header{"Authorization": {"Bearer " + tokenStr}}

	parsedResult, err := parsedAuth.Authenticate(headers, "")
	if err != nil {
		t.Fatalf("parsedAuth.Authenticate() error = %v", err)
	}

	literalResult, err := literalAuth.Authenticate(headers, "")
	if err != nil {
		t.Fatalf("literalAuth.Authenticate() error = %v", err)
	}

	if diff := cmp.Diff(parsedResult, literalResult); diff != "" {
		t.Errorf("session result diverges between Config forms (-parsed +literal):\n%s", diff)
	}

	want := &jwt.SessionResult{
		Role: "user",
		Variables: expectedVars(
			"user", []string{"user"}, "user",
			map[string]any{"x-hasura-user-id": "rt-user"},
		),
	}
	if diff := cmp.Diff(want, literalResult); diff != "" {
		t.Errorf("literal Config produced unexpected session (-want +got):\n%s", diff)
	}
}
