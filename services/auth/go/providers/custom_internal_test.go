package providers

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

func TestCustomProviderUsesNonce(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		oidcMode      bool
		nonceDisabled bool
		want          bool
	}{
		{name: "oidc with the nonce on", oidcMode: true, nonceDisabled: false, want: true},
		{name: "oidc with the nonce disabled", oidcMode: true, nonceDisabled: true, want: false},
		{name: "oauth2 has no id_token", oidcMode: false, nonceDisabled: false, want: false},
		{name: "oauth2 with the flag set", oidcMode: false, nonceDisabled: true, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			p := &customProvider{
				id:            "c:test",
				oidcMode:      tc.oidcMode,
				nonceDisabled: tc.nonceDisabled,
			}

			if got := p.UsesNonce(); got != tc.want {
				t.Errorf("expected UsesNonce() = %t, got %t", tc.want, got)
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

const (
	oidcTestKeyID    = "test-key"
	oidcTestClientID = "client-id"
	oidcTestRawNonce = "raw-nonce"
	oidcTestSub      = "test-subject"
)

// oidcTestIDP is an in-process stand-in for an OIDC IdP: it serves the JWKS and
// userinfo endpoints a discovery document points at, and mints RS256 id_tokens.
// It backs the tests below, which cover newOIDCProvider's shared runtime rather
// than any one provider.
type oidcTestIDP struct {
	server   *httptest.Server
	key      *rsa.PrivateKey
	userinfo map[string]any
}

func newOIDCTestIDP(t *testing.T) *oidcTestIDP {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	idp := &oidcTestIDP{
		server:   nil,
		key:      key,
		userinfo: nil,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/jwks.json", idp.handleJWKS)
	mux.HandleFunc("/userinfo", idp.handleUserinfo)

	idp.server = httptest.NewTLSServer(mux)
	t.Cleanup(idp.server.Close)

	return idp
}

func (f *oidcTestIDP) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	pub := &f.key.PublicKey

	jwks := map[string]any{
		"keys": []map[string]any{{
			"kty": "RSA",
			"kid": oidcTestKeyID,
			"use": "sig",
			"alg": "RS256",
			"n":   base64.RawURLEncoding.EncodeToString(pub.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes()),
		}},
	}

	if err := json.NewEncoder(w).Encode(jwks); err != nil {
		panic(err)
	}
}

func (f *oidcTestIDP) handleUserinfo(w http.ResponseWriter, _ *http.Request) {
	if err := json.NewEncoder(w).Encode(f.userinfo); err != nil {
		panic(err)
	}
}

func (f *oidcTestIDP) doc() oidc.DiscoveryDocument {
	return oidc.DiscoveryDocument{
		Issuer:                f.server.URL,
		AuthorizationEndpoint: f.server.URL + "/authorize",
		TokenEndpoint:         f.server.URL + "/token",
		UserinfoEndpoint:      f.server.URL + "/userinfo",
		JWKSURI:               f.server.URL + "/jwks.json",
	}
}

// claims returns a valid claim set; tests override entries before minting.
func (f *oidcTestIDP) claims(sub string) jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            f.server.URL,
		"aud":            oidcTestClientID,
		"sub":            sub,
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
		"nonce":          oidc.HashNonce(oidcTestRawNonce),
		"email":          "jane@example.com",
		"email_verified": true,
		"name":           "Jane Doe",
		"picture":        "https://example.com/jane.jpg",
	}
}

func (f *oidcTestIDP) mint(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = oidcTestKeyID

	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// parse re-parses a minted id_token into the *jwt.Token the native
// POST /signin/idtoken path works with, so one token can go through both flows.
func (f *oidcTestIDP) parse(t *testing.T, idToken string) *jwt.Token {
	t.Helper()

	token, err := jwt.Parse(
		idToken,
		func(*jwt.Token) (any, error) { return &f.key.PublicKey, nil },
		jwt.WithValidMethods([]string{"RS256"}),
	)
	if err != nil {
		t.Fatalf("failed to parse minted token: %v", err)
	}

	return token
}

// provider mirrors newOIDCPresetProvider against this fixture, differing only in
// the HTTP client, which has to trust the fixture's TLS certificate.
func (f *oidcTestIDP) provider(t *testing.T, id string) *Provider {
	t.Helper()

	doc := f.doc()

	provider, _ := newOIDCProvider(
		t.Context(),
		f.server.Client(),
		oidc.NewStaticDiscoverer(doc),
		doc.Issuer,
		oidcParams{
			ID:           id,
			ClientID:     oidcTestClientID,
			ClientSecret: "client-secret",
			RedirectURL:  redirectURI("https://local.auth.nhost.run", id),
			Scopes:       nil,
		},
	)

	return provider
}

// TestOIDCProviderProfileFromIDToken pins how the runtime derives an
// oidc.Profile from a validated id_token.
func TestOIDCProviderProfileFromIDToken(t *testing.T) {
	t.Parallel()

	// The cases below expect Unknown for an absent email_verified and
	// Unverified for a false one; comparing two expectations that already agree
	// would never exercise that both are unverified.
	if oidc.EmailVerificationStatusUnknown.IsVerified() ||
		oidc.EmailVerificationStatusUnverified.IsVerified() {
		t.Fatal("an unverified email must never read as verified")
	}

	cases := []struct {
		name     string
		override map[string]any
		expected oidc.Profile
	}{
		{
			name:     "verified email",
			override: nil,
			expected: oidc.Profile{
				ProviderUserID: oidcTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusVerified,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
		{
			name:     "unverified email must not be marked verified",
			override: map[string]any{"email_verified": false},
			expected: oidc.Profile{
				ProviderUserID: oidcTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnverified,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
		{
			name:     "absent email_verified is not verified",
			override: map[string]any{"email_verified": nil},
			expected: oidc.Profile{
				ProviderUserID: oidcTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusUnknown,
				Name:           "Jane Doe",
				Picture:        "https://example.com/jane.jpg",
			},
		},
		{
			// The display name comes from the standard `name` claim only; the
			// signup path defaults an empty one to the provider user ID.
			name:     "no name claim leaves the name empty",
			override: map[string]any{"name": nil},
			expected: oidc.Profile{
				ProviderUserID: oidcTestSub,
				Email:          "jane@example.com",
				EmailVerified:  oidc.EmailVerificationStatusVerified,
				Name:           "",
				Picture:        "https://example.com/jane.jpg",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newOIDCTestIDP(t)

			claims := idp.claims(oidcTestSub)
			for k, v := range tc.override {
				if v == nil {
					delete(claims, k)
					continue
				}

				claims[k] = v
			}

			idToken := idp.mint(t, claims)

			profile, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken,
				map[string]any{"nonce": oidcTestRawNonce},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if profile != tc.expected {
				t.Errorf("profile:\ngot:  %+v\nwant: %+v", profile, tc.expected)
			}
		})
	}
}

// TestOIDCProviderProfileIsIDAgnostic pins that profile derivation never
// branches on the provider ID. That is what lets the tests around it assert
// derivation once instead of once per provider.
func TestOIDCProviderProfileIsIDAgnostic(t *testing.T) {
	t.Parallel()

	idp := newOIDCTestIDP(t)
	idToken := idp.mint(t, idp.claims(oidcTestSub))
	extra := map[string]any{"nonce": oidcTestRawNonce}

	preset, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
		t.Context(), "access-token", &idToken, extra,
	)
	if err != nil {
		t.Fatalf("preset ID: unexpected error: %v", err)
	}

	custom, err := idp.provider(t, CustomProviderPrefix+"test").Oauth2().GetProfile(
		t.Context(), "access-token", &idToken, extra,
	)
	if err != nil {
		t.Fatalf("custom provider ID: unexpected error: %v", err)
	}

	if preset != custom {
		t.Errorf("profile derivation branched on the provider ID:\npreset: %+v\ncustom: %+v",
			preset, custom)
	}
}

// TestOIDCProviderUserinfoFallback covers the only path that still reaches the
// userinfo endpoint: an id_token carrying identity but not the rest of the
// profile. A response describing a different subject is no evidence about this
// user — merging its email would hand this identity a verified claim on somebody
// else's address.
func TestOIDCProviderUserinfoFallback(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		userinfoSub string
		expected    oidc.Profile
		expectedErr error
	}{
		{
			name:        "fills the profile from userinfo",
			userinfoSub: oidcTestSub,
			expected: oidc.Profile{
				ProviderUserID: oidcTestSub,
				Email:          "john@example.com",
				EmailVerified:  oidc.EmailVerificationStatusVerified,
				Name:           "John Doe",
				Picture:        "https://example.com/john.jpg",
			},
			expectedErr: nil,
		},
		{
			name:        "rejects a mismatched subject",
			userinfoSub: "some-other-subject",
			expected:    oidc.Profile{},
			expectedErr: ErrUserinfoSubjectMismatch,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newOIDCTestIDP(t)
			idp.userinfo = map[string]any{
				"sub":            tc.userinfoSub,
				"name":           "John Doe",
				"given_name":     "John",
				"family_name":    "Doe",
				"picture":        "https://example.com/john.jpg",
				"locale":         "en-US",
				"email":          "john@example.com",
				"email_verified": true,
			}

			// Everything beyond iss/sub/aud/iat/exp stripped from the token.
			claims := idp.claims(oidcTestSub)
			for _, claim := range []string{"email", "email_verified", "name", "picture"} {
				delete(claims, claim)
			}

			idToken := idp.mint(t, claims)

			profile, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken,
				map[string]any{"nonce": oidcTestRawNonce},
			)

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
				t.Errorf("profile:\ngot:  %+v\nwant: %+v", profile, tc.expected)
			}
		})
	}
}

// TestOIDCProviderNonceEnforcement pins that the browser flow's replay
// protection is enforced, not merely requested.
func TestOIDCProviderNonceEnforcement(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		tokenNonce  any
		extra       map[string]any
		expectedErr error
	}{
		{
			name:        "no nonce in the state",
			tokenNonce:  oidc.HashNonce(oidcTestRawNonce),
			extra:       map[string]any{},
			expectedErr: ErrMissingNonce,
		},
		{
			name:        "id_token echoes a different nonce",
			tokenNonce:  oidc.HashNonce("someone-elses-nonce"),
			extra:       map[string]any{"nonce": oidcTestRawNonce},
			expectedErr: oidc.ErrNonceMismatch,
		},
		{
			name:        "id_token carries no nonce claim",
			tokenNonce:  nil,
			extra:       map[string]any{"nonce": oidcTestRawNonce},
			expectedErr: oidc.ErrNonceMissing,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newOIDCTestIDP(t)

			claims := idp.claims(oidcTestSub)
			if tc.tokenNonce == nil {
				delete(claims, "nonce")
			} else {
				claims["nonce"] = tc.tokenNonce
			}

			idToken := idp.mint(t, claims)

			_, err := idp.provider(t, GoogleID).Oauth2().GetProfile(
				t.Context(), "access-token", &idToken, tc.extra,
			)

			// The exact sentinel: this fixture reaches its own JWKS over TLS, so
			// err != nil would also be satisfied by a broken fixture.
			if !errors.Is(err, tc.expectedErr) {
				t.Fatalf("expected %v, got: %v", tc.expectedErr, err)
			}
		})
	}
}
