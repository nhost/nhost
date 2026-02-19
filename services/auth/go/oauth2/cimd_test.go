package oauth2_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
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
	"github.com/nhost/nhost/services/auth/go/oauth2/mock"
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

			u, oauthErr := oauth2.ValidateCIMDURL(t.Context(), tc.clientID, false)

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
	u, oauthErr := oauth2.ValidateCIMDURL(t.Context(), "http://example.com/oauth/client.json", true)
	if oauthErr != nil {
		t.Fatalf("unexpected error: %s", oauthErr.Description)
	}

	if u.Scheme != "http" {
		t.Errorf("expected http scheme, got %q", u.Scheme)
	}

	// Private IP should pass in insecure mode
	u, oauthErr = oauth2.ValidateCIMDURL(t.Context(), "http://127.0.0.1/oauth/client.json", true)
	if oauthErr != nil {
		t.Fatalf("unexpected error for private IP in insecure mode: %s", oauthErr.Description)
	}

	if u == nil {
		t.Fatal("expected URL, got nil")
	}
}

func TestFetchCIMDMetadata(t *testing.T) { //nolint:cyclop,gocognit,maintidx
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
					"redirect_uris": []string{serverURL + "/callback"},
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

		if len(metadata.RedirectURIs) != 1 ||
			metadata.RedirectURIs[0] != serverURL+"/callback" {
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
					"redirect_uris": []string{"https://other.example.com/callback"},
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
					"redirect_uris": []string{serverURL + "/callback"},
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

	t.Run("cross-origin redirect_uri rejected", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id":     serverURL + "/client.json",
					"redirect_uris": []string{"https://evil.example.com/callback"},
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
			t.Fatal("expected error for cross-origin redirect_uri, got nil")
		}

		if !strings.Contains(oauthErr.Description, "same origin") {
			t.Errorf("expected same origin error, got %q", oauthErr.Description)
		}
	})

	t.Run("no redirect_uris", func(t *testing.T) {
		t.Parallel()

		var serverURL string

		server := httptest.NewTLSServer(
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")

				meta := map[string]any{
					"client_id": serverURL + "/client.json",
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
}

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

func TestResolveCIMDClient(t *testing.T) { //nolint:maintidx
	t.Parallel()

	logger := slog.Default()

	// Use a stable external-looking HTTPS URL for client_id in tests.
	// The rewrite transport redirects requests to the local test server.
	const fakeHost = "https://cimd-test.example.com"

	newTestClient := func(clientID string) sql.AuthOauth2Client {
		return sql.AuthOauth2Client{ //nolint:exhaustruct
			ClientID:     clientID,
			RedirectUris: []string{fakeHost + "/callback"},
			Scopes:       []string{"openid"},
			Type:         sql.OAuth2ClientTypeCIMD,
			MetadataDocumentFetchedAt: pgtype.Timestamptz{ //nolint:exhaustruct
				Time:  time.Now(),
				Valid: true,
			},
		}
	}

	cimdHandler := func(clientID string, extraFields map[string]any) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")

			meta := map[string]any{
				"client_id":     clientID,
				"redirect_uris": []string{fakeHost + "/callback"},
			}

			maps.Copy(meta, extraFields)

			json.NewEncoder(w).Encode(meta) //nolint:errcheck
		}
	}

	cases := []struct {
		name        string
		clientID    string
		handler     http.HandlerFunc
		db          func(t *testing.T, ctrl *gomock.Controller) *mock.MockDBClient
		expectedErr *oauth2.Error
	}{
		{
			name:     "cached client within TTL",
			clientID: fakeHost + "/client.json",
			handler:  nil,
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(newTestClient(fakeHost+"/client.json"), nil)

				return m
			},
			expectedErr: nil,
		},
		{
			name:     "stale client triggers re-fetch",
			clientID: fakeHost + "/client.json",
			handler:  cimdHandler(fakeHost+"/client.json", nil),
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)

				staleClient := newTestClient(fakeHost + "/client.json")
				staleClient.MetadataDocumentFetchedAt = pgtype.Timestamptz{ //nolint:exhaustruct
					Time:  time.Now().Add(-2 * time.Hour),
					Valid: true,
				}

				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(staleClient, nil)
				m.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
					Return(newTestClient(fakeHost+"/client.json"), nil)

				return m
			},
			expectedErr: nil,
		},
		{
			name:     "fresh fetch and upsert for new client",
			clientID: fakeHost + "/client.json",
			handler:  cimdHandler(fakeHost+"/client.json", nil),
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct
				m.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
					Return(newTestClient(fakeHost+"/client.json"), nil)

				return m
			},
			expectedErr: nil,
		},
		{
			name:     "no scope in metadata uses DefaultScopes",
			clientID: fakeHost + "/no-scope.json",
			handler:  cimdHandler(fakeHost+"/no-scope.json", nil),
			db: func(t *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				t.Helper()

				clientID := fakeHost + "/no-scope.json"
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct
				m.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
					DoAndReturn(func(
						_ context.Context, params sql.UpsertOAuth2CIMDClientParams,
					) (sql.AuthOauth2Client, error) {
						if diff := cmp.Diff(oauth2.DefaultScopes(), params.Scopes); diff != "" {
							t.Errorf("scopes mismatch (-want +got):\n%s", diff)
						}

						return newTestClient(clientID), nil
					})

				return m
			},
			expectedErr: nil,
		},
		{
			name:     "explicit scope in metadata overrides default",
			clientID: fakeHost + "/custom-scope.json",
			handler: cimdHandler(
				fakeHost+"/custom-scope.json",
				map[string]any{"scope": "openid email"},
			),
			db: func(t *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				t.Helper()

				clientID := fakeHost + "/custom-scope.json"
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct
				m.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
					DoAndReturn(func(
						_ context.Context, params sql.UpsertOAuth2CIMDClientParams,
					) (sql.AuthOauth2Client, error) {
						if diff := cmp.Diff(
							[]string{"openid", "email"},
							params.Scopes,
						); diff != "" {
							t.Errorf("scopes mismatch (-want +got):\n%s", diff)
						}

						return newTestClient(clientID), nil
					})

				return m
			},
			expectedErr: nil,
		},
		{
			name:     "invalid scope in metadata returns error",
			clientID: fakeHost + "/bad-scope.json",
			handler: cimdHandler(
				fakeHost+"/bad-scope.json",
				map[string]any{"scope": "openid bogus"},
			),
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/bad-scope.json").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			expectedErr: &oauth2.Error{Err: "invalid_scope", Description: "invalid scope: bogus"},
		},
		{
			name:     "invalid client_id URL",
			clientID: "not-a-url",
			handler:  nil,
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				return mock.NewMockDBClient(ctrl)
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client ID metadata document URL must use HTTPS",
			},
		},
		{
			name:     "database error looking up client",
			clientID: fakeHost + "/client.json",
			handler:  nil,
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(
						sql.AuthOauth2Client{},           //nolint:exhaustruct
						errors.New("connection refused"), //nolint:err113
					)

				return m
			},
			expectedErr: &oauth2.Error{Err: "server_error", Description: "Internal server error"},
		},
		{
			name:     "upsert failure returns error",
			clientID: fakeHost + "/client.json",
			handler:  cimdHandler(fakeHost+"/client.json", nil),
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct
				m.EXPECT().UpsertOAuth2CIMDClient(gomock.Any(), gomock.Any()).
					Return(
						sql.AuthOauth2Client{},         //nolint:exhaustruct
						errors.New("connection reset"), //nolint:err113
					)

				return m
			},
			expectedErr: &oauth2.Error{Err: "server_error", Description: "Internal server error"},
		},
		{
			name:     "fetch failure returns error",
			clientID: fakeHost + "/client.json",
			handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
			}),
			db: func(_ *testing.T, ctrl *gomock.Controller) *mock.MockDBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), fakeHost+"/client.json").
					Return(sql.AuthOauth2Client{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			expectedErr: &oauth2.Error{
				Err:         "invalid_client",
				Description: "Client metadata document returned non-200 status",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			var httpClient *http.Client
			if tc.handler != nil {
				server := httptest.NewTLSServer(tc.handler)
				defer server.Close()

				httpClient = newTestClientWithRewrite(server)
			} else {
				httpClient = &http.Client{} //nolint:exhaustruct
			}

			mockDB := tc.db(t, ctrl)

			provider := oauth2.NewProvider(
				mockDB, nil, nil, nil,
				oauth2.Config{CIMDEnabled: true}, //nolint:exhaustruct
				httpClient,
			)

			got, gotErr := provider.ResolveCIMDClient(
				context.Background(), tc.clientID, logger,
			)

			if diff := cmp.Diff(tc.expectedErr, gotErr); diff != "" {
				t.Errorf("error mismatch (-want +got):\n%s", diff)
			}

			if tc.expectedErr == nil && got.ClientID != tc.clientID {
				t.Errorf("expected client_id %q, got %q", tc.clientID, got.ClientID)
			}
		})
	}
}
