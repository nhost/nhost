package providers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"golang.org/x/oauth2"
)

// TestCustomProviderOIDCRequiresIDToken pins the anchor of the OIDC-type
// identity: without a validated id_token there is nothing to derive it from,
// so an unauthenticated userinfo response must never stand in.
func TestCustomProviderOIDCRequiresIDToken(t *testing.T) {
	t.Parallel()

	empty := ""

	missing := []struct {
		name    string
		idToken *string
	}{
		{name: "absent", idToken: nil},
		{name: "empty", idToken: &empty},
	}

	for _, tc := range missing {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// No validator and no discoverer: reaching either would panic,
			// which is the point — the check comes first.
			p := &customProvider{
				id:       "c:test",
				oidcMode: true,
			}

			_, err := p.GetProfile(
				t.Context(), "access-token", tc.idToken, map[string]any{"nonce": "raw-nonce"},
			)
			if !errors.Is(err, ErrMissingIDToken) {
				t.Fatalf("expected %v, got: %v", ErrMissingIDToken, err)
			}
		})
	}
}

func TestCustomProviderOAuth2Profile(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		claims      ClaimMapping
		body        string
		expected    oidc.Profile
		expectedErr error
	}{
		{
			name: "flat rename",
			claims: ClaimMapping{
				ID:            "user_id",
				Email:         "mail",
				EmailVerified: "verified",
				Name:          "display_name",
				Picture:       "avatar_url",
			},
			body: `{"user_id": "u-1", "mail": "jane@example.com", "verified": true,
				"display_name": "Jane", "avatar_url": "https://example.com/jane.jpg"}`,
			expected: oidc.Profile{
				ProviderUserID: "u-1",
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusVerified,
				Name:           "Jane",
				Picture:        "https://example.com/jane.jpg",
			},
			expectedErr: nil,
		},
		{
			name:   "standard names by default and numeric id",
			claims: ClaimMapping{},
			body: `{"sub": 12345, "email": "jane@example.com", "email_verified": false,
				"name": "Jane", "picture": "p"}`,
			expected: oidc.Profile{
				ProviderUserID: "12345",
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnverified,
				Name:           "Jane",
				Picture:        "p",
			},
			expectedErr: nil,
		},
		{
			name:   "large numeric id keeps full precision",
			claims: ClaimMapping{},
			body:   `{"sub": 175928847299117063, "email": "jane@example.com"}`,
			expected: oidc.Profile{
				ProviderUserID: "175928847299117063",
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnknown,
				Name:           "",
				Picture:        "",
			},
			expectedErr: nil,
		},
		{
			name:   "absent email_verified stays unknown",
			claims: ClaimMapping{},
			body:   `{"sub": "u-1", "email": "jane@example.com"}`,
			expected: oidc.Profile{
				ProviderUserID: "u-1",
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnknown,
				Name:           "",
				Picture:        "",
			},
			expectedErr: nil,
		},
		{
			name:   "non-boolean email_verified stays unknown",
			claims: ClaimMapping{},
			body:   `{"sub": "u-1", "email": "jane@example.com", "email_verified": "yes"}`,
			expected: oidc.Profile{
				ProviderUserID: "u-1",
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnknown,
				Name:           "",
				Picture:        "",
			},
			expectedErr: nil,
		},
		{
			name:        "missing id field",
			claims:      ClaimMapping{},
			body:        `{"email": "jane@example.com"}`,
			expected:    oidc.Profile{},
			expectedErr: ErrProfileMissingID,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if got := r.Header.Get("Authorization"); got != "Bearer access-token" {
						t.Errorf("unexpected authorization header: %q", got)
					}

					fmt.Fprint(w, tc.body)
				}),
			)
			defer srv.Close()

			p := &customProvider{
				id:          "c:test",
				hc:          srv.Client(),
				claims:      tc.claims,
				userinfoURL: srv.URL,
				oidcMode:    false,
			}

			profile, err := p.GetProfile(t.Context(), "access-token", nil, nil)
			if tc.expectedErr != nil {
				if !errors.Is(err, tc.expectedErr) {
					t.Fatalf("expected %v, got: %v", tc.expectedErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if profile != tc.expected {
				t.Errorf("unexpected profile:\n got: %+v\nwant: %+v", profile, tc.expected)
			}
		})
	}
}

// TestEndpointConfigIsResolvedOnce pins that OIDC-mode requests share one
// *oauth2.Config once discovery has resolved. x/oauth2 memoizes the token
// endpoint's accepted client-authentication style in an unexported field on
// the config, so handing out a per-request copy would throw that away every
// time: an IdP wanting client_secret_post would see a failed Basic attempt —
// and a second presentation of the single-use authorization code — on every
// sign-in.
func TestEndpointConfigIsResolvedOnce(t *testing.T) {
	t.Parallel()

	var discoveryHits atomic.Int64

	var srv *httptest.Server

	srv = httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			discoveryHits.Add(1)

			if err := json.NewEncoder(w).Encode(map[string]any{
				"issuer":                 srv.URL,
				"authorization_endpoint": srv.URL + "/authorize",
				"token_endpoint":         srv.URL + "/token",
				"jwks_uri":               srv.URL + "/jwks.json",
			}); err != nil {
				panic(err)
			}
		}),
	)
	defer srv.Close()

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	p := &customProvider{
		id:          "c:test",
		cfg:         &oauth2.Config{ClientID: "client-id"},
		hc:          client,
		disco:       oidc.NewDiscoverer(srv.URL, srv.URL, client, true),
		validator:   nil,
		resolvedCfg: atomic.Pointer[oauth2.Config]{},
		claims:      ClaimMapping{},
		userinfoURL: "",
		oidcMode:    true,
	}

	first, err := p.endpointConfig(t.Context())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	second, err := p.endpointConfig(t.Context())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if first != second {
		t.Error("expected the resolved config to be shared, got a fresh copy")
	}

	if first.Endpoint.TokenURL != srv.URL+"/token" {
		t.Errorf("unexpected token endpoint: %q", first.Endpoint.TokenURL)
	}

	// The static config must stay endpoint-free: the resolved copy is what
	// requests use.
	if p.cfg.Endpoint.TokenURL != "" {
		t.Errorf("the template config was mutated: %q", p.cfg.Endpoint.TokenURL)
	}

	if got := discoveryHits.Load(); got != 1 {
		t.Errorf("expected a single discovery fetch, got %d", got)
	}
}
