package auth_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/mcp/auth"
)

func TestAuth(t *testing.T) { //nolint:paralleltest
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	authServer := newTestAuthServer(t, &privateKey.PublicKey)
	t.Cleanup(authServer.Close)

	a, err := auth.New(context.Background(), authServer.URL, "test-realm", nil)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	backend := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := a.Middleware(backend)

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
			handler.ServeHTTP(rr, req)

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
		[]string{"openid", "graphql"},
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tests := []struct {
		name    string
		handler http.HandlerFunc
		check   func(t *testing.T, body map[string]any)
	}{
		{
			name:    "oauth-authorization-server",
			handler: a.AuthorizationServerHandler(),
			check:   checkAuthorizationServer(authServer.URL),
		},
		{
			name:    "oauth-protected-resource",
			handler: a.ProtectedResourceHandler(),
			check:   checkProtectedResource(authServer.URL),
		},
	}

	for _, tc := range tests { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rr := httptest.NewRecorder()

			tc.handler.ServeHTTP(rr, req)

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
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}
