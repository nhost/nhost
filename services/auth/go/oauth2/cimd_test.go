package oauth2_test

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/oauth2"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestIsCIMDClientID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		clientID string
		expected bool
	}{
		{
			name:     "valid HTTPS URL with path",
			clientID: "https://example.com/oauth/client.json",
			expected: true,
		},
		{
			name:     "valid HTTPS URL with deeper path",
			clientID: "https://my-tool.example.com/.well-known/oauth-client.json",
			expected: true,
		},
		{
			name:     "HTTP scheme",
			clientID: "http://example.com/oauth/client.json",
			expected: false,
		},
		{
			name:     "HTTPS no path",
			clientID: "https://example.com",
			expected: false,
		},
		{
			name:     "HTTPS root path only",
			clientID: "https://example.com/",
			expected: false,
		},
		{
			name:     "regular client ID",
			clientID: "nhost_abc123def456",
			expected: false,
		},
		{
			name:     "UUID client ID",
			clientID: "550e8400-e29b-41d4-a716-446655440000",
			expected: false,
		},
		{
			name:     "empty string",
			clientID: "",
			expected: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := oauth2.IsCIMDClientID(tc.clientID, false)
			if got != tc.expected {
				t.Errorf("IsCIMDClientID(%q) = %v, want %v", tc.clientID, got, tc.expected)
			}
		})
	}
}

func TestIsCIMDClientIDInsecure(t *testing.T) {
	t.Parallel()

	// HTTP URL should be accepted in insecure mode
	if !oauth2.IsCIMDClientID("http://example.com/oauth/client.json", true) {
		t.Error("expected HTTP URL to be accepted in insecure mode")
	}

	// HTTP URL should still be rejected in secure mode
	if oauth2.IsCIMDClientID("http://example.com/oauth/client.json", false) {
		t.Error("expected HTTP URL to be rejected in secure mode")
	}
}

func TestValidateCIMDURL(t *testing.T) { //nolint:cyclop
	t.Parallel()

	cases := []struct {
		name      string
		clientID  string
		expectErr bool
		errDesc   string
	}{
		{
			name:      "valid URL",
			clientID:  "https://example.com/oauth/client.json",
			expectErr: false,
			errDesc:   "",
		},
		{
			name:      "HTTP scheme",
			clientID:  "http://example.com/oauth/client.json",
			expectErr: true,
			errDesc:   "HTTPS",
		},
		{
			name:      "no path",
			clientID:  "https://example.com",
			expectErr: true,
			errDesc:   "path",
		},
		{
			name:      "root path",
			clientID:  "https://example.com/",
			expectErr: true,
			errDesc:   "path",
		},
		{
			name:      "fragment",
			clientID:  "https://example.com/client.json#frag",
			expectErr: true,
			errDesc:   "fragment",
		},
		{
			name:      "credentials",
			clientID:  "https://user:pass@example.com/client.json",
			expectErr: true,
			errDesc:   "credentials",
		},
		{
			name:      "dot segments",
			clientID:  "https://example.com/foo/../client.json",
			expectErr: true,
			errDesc:   "dot segments",
		},
		{
			name:      "loopback IP",
			clientID:  "https://127.0.0.1/client.json",
			expectErr: true,
			errDesc:   "private",
		},
		{
			name:      "private IP",
			clientID:  "https://192.168.1.1/client.json",
			expectErr: true,
			errDesc:   "private",
		},
		{
			name:      "link-local IP",
			clientID:  "https://169.254.1.1/client.json",
			expectErr: true,
			errDesc:   "private",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			u, oauthErr := oauth2.ValidateCIMDURL(tc.clientID, false)

			if tc.expectErr && oauthErr == nil {
				t.Fatal("expected error, got nil")
			}

			if tc.expectErr && tc.errDesc != "" &&
				!strings.Contains(oauthErr.Description, tc.errDesc) {
				t.Errorf(
					"expected error description to contain %q, got %q",
					tc.errDesc,
					oauthErr.Description,
				)
			}

			if !tc.expectErr && oauthErr != nil {
				t.Fatalf("unexpected error: %s", oauthErr.Description)
			}

			if !tc.expectErr && u == nil {
				t.Fatal("expected URL, got nil")
			}
		})
	}
}

func TestValidateCIMDURLInsecure(t *testing.T) {
	t.Parallel()

	// HTTP URL should pass in insecure mode
	u, oauthErr := oauth2.ValidateCIMDURL("http://example.com/oauth/client.json", true)
	if oauthErr != nil {
		t.Fatalf("unexpected error: %s", oauthErr.Description)
	}

	if u.Scheme != "http" {
		t.Errorf("expected http scheme, got %q", u.Scheme)
	}

	// Private IP should pass in insecure mode
	u, oauthErr = oauth2.ValidateCIMDURL("http://127.0.0.1/oauth/client.json", true)
	if oauthErr != nil {
		t.Fatalf("unexpected error for private IP in insecure mode: %s", oauthErr.Description)
	}

	if u == nil {
		t.Fatal("expected URL, got nil")
	}
}

func TestFetchCIMDMetadata(t *testing.T) { //nolint:gocognit,cyclop,maintidx
	t.Parallel()

	logger := slog.Default()

	t.Run("valid document", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     serverURL + "/client.json",
					"client_name":   "Test App",
					"redirect_uris": []string{"https://app.example.com/callback"},
					"client_uri":    "https://app.example.com",
					"logo_uri":      "https://app.example.com/logo.png",
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		serverURL = server.URL
		clientIDURL := serverURL + "/client.json"

		metadata, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			clientIDURL,
			logger,
		)

		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if metadata.ClientName != "Test App" {
			t.Errorf("expected client_name 'Test App', got %q", metadata.ClientName)
		}

		if len(metadata.RedirectURIs) != 1 ||
			metadata.RedirectURIs[0] != "https://app.example.com/callback" {
			t.Errorf("unexpected redirect_uris: %v", metadata.RedirectURIs)
		}
	})

	t.Run("non-200 status", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNotFound)
			}),
		)
		defer server.Close()

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			server.URL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if oauthErr.Err != "invalid_client" {
			t.Errorf("expected error code 'invalid_client', got %q", oauthErr.Err)
		}
	})

	t.Run("client_id mismatch", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     "https://other.example.com/client.json",
					"client_name":   "Test App",
					"redirect_uris": []string{"https://app.example.com/callback"},
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			server.URL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if !strings.Contains(oauthErr.Description, "does not match") {
			t.Errorf("expected mismatch error, got %q", oauthErr.Description)
		}
	})

	t.Run("response too large", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`{"client_id":"`)) //nolint:errcheck
				// Write more than 5KB
				w.Write(make([]byte, 6*1024)) //nolint:errcheck
			}),
		)
		defer server.Close()

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			server.URL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if !strings.Contains(oauthErr.Description, "maximum size") {
			t.Errorf("expected size error, got %q", oauthErr.Description)
		}
	})

	t.Run("invalid JSON", func(t *testing.T) {
		t.Parallel()

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(`not json`)) //nolint:errcheck
			}),
		)
		defer server.Close()

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			server.URL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if !strings.Contains(oauthErr.Description, "JSON") {
			t.Errorf("expected JSON error, got %q", oauthErr.Description)
		}
	})

	t.Run("prohibited client_secret field", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     serverURL + "/client.json",
					"client_name":   "Test App",
					"redirect_uris": []string{"https://app.example.com/callback"},
					"client_secret": "should-not-be-here",
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		serverURL = server.URL

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			serverURL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if !strings.Contains(oauthErr.Description, "client_secret") {
			t.Errorf("expected client_secret error, got %q", oauthErr.Description)
		}
	})

	t.Run("no redirect_uris", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":   serverURL + "/client.json",
					"client_name": "Test App",
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		serverURL = server.URL

		_, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			serverURL+"/client.json",
			logger,
		)

		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if !strings.Contains(oauthErr.Description, "redirect_uri") {
			t.Errorf("expected redirect_uri error, got %q", oauthErr.Description)
		}
	})

	t.Run("missing client_name defaults to hostname", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     serverURL + "/client.json",
					"redirect_uris": []string{"https://app.example.com/callback"},
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		serverURL = server.URL

		metadata, oauthErr := oauth2.FetchCIMDMetadata(
			context.Background(),
			server.Client(),
			serverURL+"/client.json",
			logger,
		)

		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if metadata.ClientName == "" {
			t.Error("expected client_name to default to hostname, got empty")
		}
	})
}

//go:generate mockgen -package oauth2_test -destination mock_db_test.go github.com/nhost/nhost/services/auth/go/oauth2 DBClient

// rewriteTransport rewrites requests from a fake external HTTPS URL to a local
// test server, allowing tests to use non-loopback client_id URLs that pass SSRF
// validation while still hitting an httptest server.
type rewriteTransport struct {
	inner     http.RoundTripper
	targetURL string // the httptest server URL (https://127.0.0.1:PORT)
}

func (t *rewriteTransport) RoundTrip(
	req *http.Request,
) (*http.Response, error) {
	// Rewrite the URL host to the test server
	target, _ := url.Parse(t.targetURL)
	req = req.Clone(req.Context())
	req.URL.Host = target.Host

	resp, err := t.inner.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("roundtrip: %w", err)
	}

	return resp, nil
}

func newTestClientWithRewrite(
	server *httptest.Server,
) *http.Client {
	base := server.Client()

	return &http.Client{ //nolint:exhaustruct
		Transport: &rewriteTransport{
			inner:     base.Transport,
			targetURL: server.URL,
		},
	}
}

func TestResolveCIMDClient(t *testing.T) { //nolint:cyclop,maintidx
	t.Parallel()

	logger := slog.Default()

	// Use a stable external-looking HTTPS URL for client_id in tests.
	// The rewrite transport redirects requests to the local test server.
	const fakeHost = "https://cimd-test.example.com"

	newTestClient := func(clientID string) sql.AuthOauth2Client {
		return sql.AuthOauth2Client{ //nolint:exhaustruct
			ClientID:      clientID,
			ClientName:    "Test App",
			IsPublic:      true,
			RedirectUris:  []string{"https://app.example.com/callback"},
			GrantTypes:    []string{"authorization_code"},
			ResponseTypes: []string{"code"},
			Scopes:        []string{"openid"},
			Type:          sql.OAuth2ClientTypeCIMD,
			MetadataDocumentFetchedAt: pgtype.Timestamptz{ //nolint:exhaustruct
				Time:  time.Now(),
				Valid: true,
			},
		}
	}

	t.Run("cached client within TTL", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/client.json"

		cachedClient := newTestClient(clientID)
		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(cachedClient, nil)

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			&http.Client{},                   //nolint:exhaustruct
		)

		got, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if diff := cmp.Diff(cachedClient, got); diff != "" {
			t.Errorf("unexpected client (-want +got):\n%s", diff)
		}
	})

	t.Run("stale client triggers re-fetch", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/client.json"

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     clientID,
					"client_name":   "Updated App",
					"redirect_uris": []string{"https://app.example.com/callback"},
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		staleClient := newTestClient(clientID)
		staleClient.MetadataDocumentFetchedAt = pgtype.Timestamptz{ //nolint:exhaustruct
			Time:  time.Now().Add(-2 * time.Hour),
			Valid: true,
		}

		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(staleClient, nil)

		updatedClient := newTestClient(clientID)
		updatedClient.ClientName = "Updated App"

		mockDB.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
			Return(updatedClient, nil)

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			newTestClientWithRewrite(server),
		)

		got, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if got.ClientName != "Updated App" {
			t.Errorf("expected client_name 'Updated App', got %q", got.ClientName)
		}
	})

	t.Run("fresh fetch and upsert for new client", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/client.json"

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     clientID,
					"client_name":   "New App",
					"redirect_uris": []string{"https://newapp.example.com/callback"},
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		newClient := newTestClient(clientID)
		newClient.ClientName = "New App"
		newClient.RedirectUris = []string{"https://newapp.example.com/callback"}

		mockDB.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
			Return(newClient, nil)

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			newTestClientWithRewrite(server),
		)

		got, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}

		if got.ClientName != "New App" {
			t.Errorf("expected client_name 'New App', got %q", got.ClientName)
		}
	})

	t.Run("no scope in metadata uses DefaultScopes", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/no-scope.json"

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     clientID,
					"client_name":   "No Scope App",
					"redirect_uris": []string{"https://app.example.com/callback"},
					// no "scope" field
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		mockDB.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
			DoAndReturn(func(
				_ context.Context, params sql.UpsertOAuth2CIMDClientParams,
			) (sql.AuthOauth2Client, error) {
				if diff := cmp.Diff(oauth2.DefaultScopes(), params.Scopes); diff != "" {
					t.Errorf("scopes mismatch (-want +got):\n%s", diff)
				}

				return newTestClient(clientID), nil
			})

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			newTestClientWithRewrite(server),
		)

		_, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}
	})

	t.Run("explicit scope in metadata overrides default", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/custom-scope.json"

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     clientID,
					"client_name":   "Custom Scope App",
					"redirect_uris": []string{"https://app.example.com/callback"},
					"scope":         "openid email",
				}

				json.NewEncoder(w).Encode(meta) //nolint:errcheck
			}),
		)
		defer server.Close()

		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		mockDB.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
			DoAndReturn(func(
				_ context.Context, params sql.UpsertOAuth2CIMDClientParams,
			) (sql.AuthOauth2Client, error) {
				expected := []string{"openid", "email"}
				if diff := cmp.Diff(expected, params.Scopes); diff != "" {
					t.Errorf("scopes mismatch (-want +got):\n%s", diff)
				}

				return newTestClient(clientID), nil
			})

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			newTestClientWithRewrite(server),
		)

		_, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr != nil {
			t.Fatalf("unexpected error: %s", oauthErr.Description)
		}
	})

	t.Run("fetch failure returns error", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		mockDB := NewMockDBClient(ctrl)
		clientID := fakeHost + "/client.json"

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			}),
		)
		defer server.Close()

		mockDB.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
			Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

		provider := oauth2.NewProvider(
			mockDB, nil, nil, nil, nil,
			oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
			newTestClientWithRewrite(server),
		)

		_, oauthErr := provider.ResolveCIMDClient(
			context.Background(), clientID, logger,
		)
		if oauthErr == nil {
			t.Fatal("expected error, got nil")
		}

		if oauthErr.Err != "invalid_client" {
			t.Errorf("expected 'invalid_client', got %q", oauthErr.Err)
		}
	})
}
