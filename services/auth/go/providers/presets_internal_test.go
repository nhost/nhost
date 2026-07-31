package providers

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/oidc"
)

const (
	presetTestKeyID    = "test-key"
	presetTestClientID = "client-id"
	presetTestRawNonce = "raw-nonce"
)

// TestPresetDocuments asserts the invariants every pinned document has to
// hold, so adding a provider to presets.go cannot quietly ship a broken one.
func TestPresetDocuments(t *testing.T) {
	t.Parallel()

	for id, doc := range oidcPresetDocuments() {
		t.Run(id, func(t *testing.T) {
			t.Parallel()

			// The same validation a fetched document goes through.
			if _, err := oidc.NewStaticDiscoverer(doc).Get(t.Context()); err != nil {
				t.Fatalf("pinned document is invalid: %v", err)
			}

			issuer, err := url.Parse(doc.Issuer)
			if err != nil || issuer.Host == "" || issuer.Scheme != "https" {
				t.Errorf("issuer must be an absolute https URL, got %q", doc.Issuer)
			}

			// A preset keeps its built-in ID: one that looked custom would be
			// misread by isCustomProviderID, silently changing who its users can
			// auto-link with.
			if strings.HasPrefix(id, CustomProviderPrefix) {
				t.Errorf("preset ID %q must not use the custom provider prefix", id)
			}

			// The browser flow falls back to userinfo when an id_token carries
			// no email, so a preset without one has no way to recover.
			if doc.UserinfoEndpoint == "" {
				t.Error("preset document must advertise a userinfo endpoint")
			}
		})
	}
}

// presetTestIDP is an in-process stand-in for a preset's IdP. It serves the
// JWKS and userinfo endpoints a pinned discovery document points at, and mints
// RS256 id_tokens.
//
// oidc and controller carry their own signing fixtures; merging the three into
// a shared helper was considered and declined, so this stays minimal.
type presetTestIDP struct {
	server   *httptest.Server
	key      *rsa.PrivateKey
	userinfo map[string]any
}

func newPresetTestIDP(t *testing.T) *presetTestIDP {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	idp := &presetTestIDP{
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

func (f *presetTestIDP) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	pub := &f.key.PublicKey

	jwks := map[string]any{
		"keys": []map[string]any{{
			"kty": "RSA",
			"kid": presetTestKeyID,
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

func (f *presetTestIDP) handleUserinfo(w http.ResponseWriter, _ *http.Request) {
	if err := json.NewEncoder(w).Encode(f.userinfo); err != nil {
		panic(err)
	}
}

// doc mirrors a pinned preset document for this fixture's endpoints.
func (f *presetTestIDP) doc() oidc.DiscoveryDocument {
	return oidc.DiscoveryDocument{
		Issuer:                f.server.URL,
		AuthorizationEndpoint: f.server.URL + "/authorize",
		TokenEndpoint:         f.server.URL + "/token",
		UserinfoEndpoint:      f.server.URL + "/userinfo",
		JWKSURI:               f.server.URL + "/jwks.json",
	}
}

// claims returns a valid, OIDC-standard id_token claim set; tests override
// entries before minting.
func (f *presetTestIDP) claims(sub string) jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            f.server.URL,
		"aud":            presetTestClientID,
		"sub":            sub,
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
		"nonce":          oidc.HashNonce(presetTestRawNonce),
		"email":          "jane@example.com",
		"email_verified": true,
		"name":           "Jane Doe",
		"picture":        "https://example.com/jane.jpg",
	}
}

func (f *presetTestIDP) mint(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = presetTestKeyID

	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// parse re-parses a minted id_token into the *jwt.Token the native
// POST /signin/idtoken path works with, so one token can go through both google
// flows in the same test.
func (f *presetTestIDP) parse(t *testing.T, idToken string) *jwt.Token {
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

// provider builds what a preset builds, against this fixture instead of a
// pinned document. It mirrors newOIDCPresetProvider exactly except for the
// HTTP client, which has to trust the fixture's TLS certificate.
func (f *presetTestIDP) provider(t *testing.T, id string) *Provider {
	t.Helper()

	doc := f.doc()

	provider, _ := newOIDCProvider(
		t.Context(),
		f.server.Client(),
		oidc.NewStaticDiscoverer(doc),
		doc.Issuer,
		oidcParams{
			ID:           id,
			ClientID:     presetTestClientID,
			ClientSecret: "client-secret",
			RedirectURL:  redirectURI("https://local.auth.nhost.run", id),
			Scopes:       nil,
		},
	)

	return provider
}
