package oidc_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const fixtureKeyID = "test-key"

// fakeIDP is an in-process TLS OIDC provider: it serves a discovery
// document and a JWKS, and mints RS256 id_tokens. Failure modes are
// injected via failDiscovery and mutateDoc.
type fakeIDP struct {
	server *httptest.Server
	key    *rsa.PrivateKey

	mu            sync.Mutex
	discoveryHits int
	jwksHits      int
	failDiscovery bool
	mutateDoc     func(doc map[string]any)
}

func newFakeIDP(t *testing.T) *fakeIDP {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	idp := &fakeIDP{
		key: key,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", idp.handleDiscovery)
	mux.HandleFunc("/jwks.json", idp.handleJWKS)

	idp.server = httptest.NewTLSServer(mux)
	t.Cleanup(idp.server.Close)

	return idp
}

func (f *fakeIDP) URL() string {
	return f.server.URL
}

func (f *fakeIDP) DiscoveryURL() string {
	return f.server.URL + "/.well-known/openid-configuration"
}

func (f *fakeIDP) DiscoveryHits() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.discoveryHits
}

func (f *fakeIDP) JWKSHits() int {
	f.mu.Lock()
	defer f.mu.Unlock()

	return f.jwksHits
}

func (f *fakeIDP) SetFailDiscovery(fail bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.failDiscovery = fail
}

func (f *fakeIDP) SetMutateDoc(mutate func(doc map[string]any)) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.mutateDoc = mutate
}

func (f *fakeIDP) handleDiscovery(w http.ResponseWriter, _ *http.Request) {
	f.mu.Lock()
	f.discoveryHits++
	fail := f.failDiscovery
	mutate := f.mutateDoc
	f.mu.Unlock()

	if fail {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	doc := map[string]any{
		"issuer":                 f.server.URL,
		"authorization_endpoint": f.server.URL + "/authorize",
		"token_endpoint":         f.server.URL + "/token",
		"userinfo_endpoint":      f.server.URL + "/userinfo",
		"jwks_uri":               f.server.URL + "/jwks.json",
	}

	if mutate != nil {
		mutate(doc)
	}

	if err := json.NewEncoder(w).Encode(doc); err != nil {
		panic(err)
	}
}

func (f *fakeIDP) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	f.mu.Lock()
	f.jwksHits++
	f.mu.Unlock()

	pub := &f.key.PublicKey

	jwks := map[string]any{
		"keys": []map[string]any{{
			"kty": "RSA",
			"kid": fixtureKeyID,
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

// DefaultClaims returns a valid id_token claim set for this IdP; tests
// override entries before minting to produce invalid tokens.
func (f *fakeIDP) DefaultClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            f.server.URL,
		"aud":            "client-id",
		"sub":            "user-1",
		"email":          "jane@example.com",
		"email_verified": true,
		"name":           "Jane",
		"picture":        "https://example.com/jane.jpg",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	}
}

// MintToken signs claims with the IdP's RSA key (RS256, known kid).
func (f *fakeIDP) MintToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = fixtureKeyID

	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// MintTokenForeignKey signs claims with an RSA key that is NOT published in
// the IdP's JWKS, under the JWKS's known kid — used to prove the published
// key, not just the alg header, gates acceptance.
func (f *fakeIDP) MintTokenForeignKey(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	foreign, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = fixtureKeyID

	signed, err := token.SignedString(foreign)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// MintTokenUnknownKid signs claims with the IdP's own key but under a kid
// absent from the JWKS — used to prove the JWKS is genuinely consulted for
// key selection.
func (f *fakeIDP) MintTokenUnknownKid(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "not-in-jwks"

	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// MintHS256Token signs claims with a symmetric key — used to prove the
// asymmetric-only allowlist rejects it.
func (f *fakeIDP) MintHS256Token(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token.Header["kid"] = fixtureKeyID

	signed, err := token.SignedString([]byte("symmetric-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// MintNoneToken produces an alg=none token.
func (f *fakeIDP) MintNoneToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)

	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// padding returns a JSON-safe string of n bytes for size-cap tests.
func padding(n int) string {
	return strings.Repeat("x", n)
}
