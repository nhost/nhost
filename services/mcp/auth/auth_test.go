package auth_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/mcp/auth"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

func TestAuth(t *testing.T) { //nolint:paralleltest
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	authServer := newTestAuthServer(t, &privateKey.PublicKey)
	t.Cleanup(authServer.Close)

	a, err := auth.New(context.Background(), authServer.URL, "test-realm", "")
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	router := gin.New()
	router.POST("/mcp", a.Middleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	tests := []struct {
		name           string
		authorization  string
		expectedStatus int
		checkWWWAuth   bool
	}{
		{
			name:           "no authorization header",
			authorization:  "",
			expectedStatus: http.StatusUnauthorized,
			checkWWWAuth:   true,
		},
		{
			name:           "invalid authorization scheme",
			authorization:  "Basic dXNlcjpwYXNz",
			expectedStatus: http.StatusUnauthorized,
			checkWWWAuth:   true,
		},
		{
			name:           "empty bearer token",
			authorization:  "Bearer ",
			expectedStatus: http.StatusUnauthorized,
			checkWWWAuth:   true,
		},
		{
			name:           "invalid bearer token",
			authorization:  "Bearer invalid-token",
			expectedStatus: http.StatusUnauthorized,
			checkWWWAuth:   true,
		},
		{
			name:           "expired token",
			authorization:  "Bearer " + makeToken(t, privateKey, authServer.URL, true),
			expectedStatus: http.StatusUnauthorized,
			checkWWWAuth:   true,
		},
		{
			name:           "valid token",
			authorization:  "Bearer " + makeToken(t, privateKey, authServer.URL, false),
			expectedStatus: http.StatusOK,
			checkWWWAuth:   false,
		},
	}

	for _, tc := range tests { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/mcp", nil)
			if tc.authorization != "" {
				req.Header.Set("Authorization", tc.authorization)
			}

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != tc.expectedStatus {
				t.Errorf(
					"expected status %d, got %d",
					tc.expectedStatus,
					rr.Code,
				)
			}

			if tc.checkWWWAuth {
				wwwAuth := rr.Header().Get("WWW-Authenticate")
				if wwwAuth == "" {
					t.Error("expected WWW-Authenticate header")
				}

				if !strings.Contains(wwwAuth, `resource_metadata="http://`) {
					t.Errorf(
						"expected resource_metadata to use http:// scheme, got: %s",
						wwwAuth,
					)
				}
			}
		})
	}
}

func TestMiddlewareSessionLogging(t *testing.T) { //nolint:paralleltest
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	authServer := newTestAuthServer(t, &privateKey.PublicKey)
	t.Cleanup(authServer.Close)

	a, err := auth.New(context.Background(), authServer.URL, "test-realm", "")
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	var logBuf bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))

	router := gin.New()
	router.Use(middleware.Logger(logger))
	router.POST("/mcp", a.Middleware(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/mcp", nil)
	req.Header.Set(
		"Authorization",
		"Bearer "+makeToken(t, privateKey, authServer.URL, false),
	)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	logOutput := logBuf.String()

	for _, expected := range []string{
		`"sub"`,
		`"test-user"`,
		`"x-hasura-user-id"`,
		`"test-user-id"`,
		`"x-hasura-default-role"`,
		`"user"`,
		`"x-hasura-allowed-roles"`,
	} {
		if !strings.Contains(logOutput, expected) {
			t.Errorf(
				"expected log output to contain %s, got:\n%s",
				expected,
				logOutput,
			)
		}
	}
}

func TestEnforceRole(t *testing.T) { //nolint:paralleltest
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	authServer := newTestAuthServer(t, &privateKey.PublicKey)
	t.Cleanup(authServer.Close)

	tests := []struct {
		name           string
		enforceRole    string
		expectedStatus int
	}{
		{
			name:           "matching role",
			enforceRole:    "user",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "mismatched role",
			enforceRole:    "admin",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "no enforcement",
			enforceRole:    "",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tc := range tests { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			a, err := auth.New(
				context.Background(),
				authServer.URL,
				"test-realm",
				tc.enforceRole,
			)
			if err != nil {
				t.Fatalf("failed to create auth: %v", err)
			}

			router := gin.New()
			router.POST("/mcp", a.Middleware(), func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodPost, "/mcp", nil)
			req.Header.Set(
				"Authorization",
				"Bearer "+makeToken(t, privateKey, authServer.URL, false),
			)

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != tc.expectedStatus {
				t.Errorf(
					"expected status %d, got %d",
					tc.expectedStatus,
					rr.Code,
				)
			}
		})
	}
}

func TestDiscoveryEndpoints(t *testing.T) { //nolint:paralleltest
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	authServer := newTestAuthServer(t, &privateKey.PublicKey)
	t.Cleanup(authServer.Close)

	a, err := auth.New(
		context.Background(),
		authServer.URL,
		"test-realm",
		"",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tests := []struct {
		name    string
		path    string
		handler gin.HandlerFunc
		check   func(t *testing.T, body map[string]any)
	}{
		{
			name:    "oauth-authorization-server",
			path:    "/.well-known/oauth-authorization-server",
			handler: a.AuthorizationServerHandler(),
			check:   checkAuthorizationServer(authServer.URL),
		},
		{
			name:    "oauth-protected-resource",
			path:    "/.well-known/oauth-protected-resource",
			handler: a.ProtectedResourceHandler(),
			check:   checkProtectedResource(authServer.URL),
		},
	}

	for _, tc := range tests { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.GET(tc.path, tc.handler)

			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			rr := httptest.NewRecorder()

			router.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", rr.Code)
			}

			var body map[string]any
			if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			tc.check(t, body)
		})
	}
}

func checkAuthorizationServer(
	authServerURL string,
) func(t *testing.T, body map[string]any) {
	return func(t *testing.T, body map[string]any) {
		t.Helper()

		if body["issuer"] != authServerURL {
			t.Errorf(
				"expected issuer %s, got %s",
				authServerURL,
				body["issuer"],
			)
		}

		if body["authorization_endpoint"] != authServerURL+"/oauth2/authorize" {
			t.Errorf(
				"unexpected authorization_endpoint: %s",
				body["authorization_endpoint"],
			)
		}

		if _, hasRegistration := body["registration_endpoint"]; hasRegistration {
			t.Error("unexpected registration_endpoint in metadata")
		}

		cimd, ok := body["client_id_metadata_document_supported"].(bool)
		if !ok || !cimd {
			t.Error("expected client_id_metadata_document_supported to be true")
		}
	}
}

func checkProtectedResource(
	authServerURL string,
) func(t *testing.T, body map[string]any) {
	return func(t *testing.T, body map[string]any) {
		t.Helper()

		resource, ok := body["resource"].(string)
		if !ok {
			t.Fatal("expected resource string")
		}

		if !strings.HasPrefix(resource, "http://") {
			t.Errorf("expected resource to use http:// scheme, got %s", resource)
		}

		servers, ok := body["authorization_servers"].([]any)
		if !ok || len(servers) == 0 {
			t.Fatal("expected authorization_servers array")
		}

		if servers[0] != authServerURL {
			t.Errorf(
				"expected auth server %s, got %s",
				authServerURL,
				servers[0],
			)
		}

		scopes, ok := body["scopes_supported"].([]any)
		if !ok || len(scopes) == 0 {
			t.Fatal("expected scopes_supported array")
		}

		expectedScopes := []string{"openid", "graphql"}
		for i, expected := range expectedScopes {
			if scopes[i] != expected {
				t.Errorf(
					"expected scope %s, got %s",
					expected,
					scopes[i],
				)
			}
		}
	}
}

func newTestAuthServer(
	t *testing.T,
	publicKey *rsa.PublicKey,
) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	mux.HandleFunc(
		"/.well-known/jwks.json",
		func(w http.ResponseWriter, _ *http.Request) {
			jwks := map[string]any{
				"keys": []map[string]any{
					{
						"kty": "RSA",
						"alg": "RS256",
						"use": "sig",
						"kid": "test-key",
						"n": base64.RawURLEncoding.EncodeToString(
							publicKey.N.Bytes(),
						),
						"e": base64.RawURLEncoding.EncodeToString(
							big.NewInt(int64(publicKey.E)).Bytes(),
						),
					},
				},
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(jwks) //nolint:errcheck
		},
	)

	return httptest.NewServer(mux)
}

func makeToken(
	t *testing.T,
	key *rsa.PrivateKey,
	issuer string,
	expired bool,
) string {
	t.Helper()

	now := time.Now()
	exp := now.Add(time.Hour)

	if expired {
		exp = now.Add(-time.Hour)
	}

	claims := jwt.MapClaims{
		"sub": "test-user",
		"iss": issuer,
		"iat": jwt.NewNumericDate(now),
		"exp": jwt.NewNumericDate(exp),
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-user-id":       "test-user-id",
			"x-hasura-default-role":  "user",
			"x-hasura-allowed-roles": []string{"user", "me"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}
