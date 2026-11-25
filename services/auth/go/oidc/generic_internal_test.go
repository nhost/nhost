package oidc

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"golang.org/x/oauth2"
)

const (
	fixtureCode    = "upstream-code"
	fixtureNonce   = "browser-nonce"
	fixtureEmail   = "person@example.com"
	fixtureSubject = "stable-subject"
)

type oidcFixture struct {
	issuer               string
	client               *http.Client
	key                  *rsa.PrivateKey
	keyID                atomic.Pointer[string]
	discoveryCalls       atomic.Int32
	keyCalls             atomic.Int32
	tokenCalls           atomic.Int32
	failDiscovery        atomic.Bool
	verifier             string
	wrongUserInfoSubject bool
}

func newOIDCFixture(t *testing.T, wrongUserInfoSubject bool) *oidcFixture {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}

	f := &oidcFixture{
		key:                  key,
		verifier:             oauth2.GenerateVerifier(),
		wrongUserInfoSubject: wrongUserInfoSubject,
	}
	f.keyID.Store(new("key-1"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /application/o/test/.well-known/openid-configuration", func(
		w http.ResponseWriter, _ *http.Request,
	) {
		f.discoveryCalls.Add(1)

		if f.failDiscovery.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}

		writeFixtureJSON(t, w, map[string]any{
			"issuer":                                f.issuer,
			"authorization_endpoint":                f.issuer + "authorize/",
			"token_endpoint":                        f.issuer + "token/",
			"jwks_uri":                              f.issuer + "jwks/",
			"userinfo_endpoint":                     f.issuer + "userinfo/",
			"id_token_signing_alg_values_supported": []string{"RS256", "HS256", "none"},
			"authorization_response_iss_parameter_supported": true,
		})
	})
	mux.HandleFunc("GET /application/o/test/jwks/", func(w http.ResponseWriter, _ *http.Request) {
		f.keyCalls.Add(1)

		jwk, err := jwkset.NewJWKFromKey(&f.key.PublicKey, jwkset.JWKOptions{
			Metadata: jwkset.JWKMetadataOptions{
				KID: *f.keyID.Load(), USE: jwkset.UseSig, ALG: jwkset.AlgRS256,
			},
		})
		if err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusInternalServerError)

			return
		}

		writeFixtureJSON(t, w, jwkset.JWKSMarshal{Keys: []jwkset.JWKMarshal{jwk.Marshal()}})
	})
	mux.HandleFunc("POST /application/o/test/token/", func(w http.ResponseWriter, r *http.Request) {
		f.tokenCalls.Add(1)

		clientID, secret, _ := r.BasicAuth()
		if err := r.ParseForm(); err != nil || clientID != "web" || secret != "secret" ||
			r.PostForm.Get(
				"code",
			) != fixtureCode || r.PostForm.Get("code_verifier") != f.verifier ||
			r.PostForm.Get(
				"redirect_uri",
			) != "https://auth.example.com/v1/signin/oidc/first/callback" {
			t.Error("invalid token request")
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		claims := f.claims("web", fixtureNonce)
		delete(claims, "email")

		idToken, err := f.sign(claims, *f.keyID.Load())
		if err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusInternalServerError)

			return
		}

		writeFixtureJSON(t, w, map[string]string{
			"access_token": "fixture-access-token", "token_type": "Bearer", "id_token": idToken,
		})
	})
	mux.HandleFunc(
		"GET /application/o/test/userinfo/",
		func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Authorization") != "Bearer fixture-access-token" {
				t.Error("invalid UserInfo authorization header")
				w.WriteHeader(http.StatusUnauthorized)

				return
			}

			subject := fixtureSubject
			if f.wrongUserInfoSubject {
				subject = "another-subject"
			}

			writeFixtureJSON(t, w, map[string]any{
				"sub": subject, "email": fixtureEmail, "email_verified": true,
			})
		},
	)

	server := httptest.NewTLSServer(mux)
	t.Cleanup(server.Close)
	f.issuer = server.URL + "/application/o/test/"
	f.client = server.Client()

	return f
}

func writeFixtureJSON(t *testing.T, w http.ResponseWriter, body any) {
	t.Helper()

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(body); err != nil {
		t.Error(err)
	}
}

func (f *oidcFixture) claims(audience, nonce string) jwt.MapClaims {
	now := time.Now()

	return jwt.MapClaims{
		"iss": f.issuer, "sub": fixtureSubject, "aud": audience,
		"iat": now.Unix(), "exp": now.Add(time.Minute).Unix(),
		"email": fixtureEmail, "email_verified": true, "nonce": nonce,
	}
}

func (f *oidcFixture) sign(claims jwt.MapClaims, kid string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kid

	return token.SignedString(f.key) //nolint:wrapcheck
}

func (f *oidcFixture) registry(t *testing.T) *OIDCRegistry {
	t.Helper()

	serverURL, err := url.Parse("https://auth.example.com/v1")
	if err != nil {
		t.Fatal(err)
	}

	raw := `[
		{"slug":"first","issuer":"` + f.issuer + `","clientId":"web","clientSecret":"secret","audiences":["mobile","desktop"]},
		{"slug":"second","issuer":"` + f.issuer + `","clientId":"another","clientSecret":"other"}
	]`

	registry, err := NewOIDCRegistry(raw, serverURL, f.client)
	if err != nil {
		t.Fatal(err)
	}

	return registry
}

func TestOIDCBrowserProtocol(t *testing.T) {
	t.Parallel()

	f := newOIDCFixture(t, false)
	registry := f.registry(t)

	p := registry.Get("first")
	if registry.Get("unknown") != nil || len(registry.All()) != 2 ||
		p.ID() != "oidc:first" || registry.Get("second").ClientID() != "another" {
		t.Fatal("expected two isolated provider configurations")
	}

	location, err := p.AuthorizationURL(t.Context(), "signed-state", fixtureNonce, f.verifier)
	if err != nil {
		t.Fatal(err)
	}

	assertAuthorizationURL(t, location, f.verifier)

	for _, issuer := range []*string{nil, new("https://another.example")} {
		if _, err := p.Exchange(
			t.Context(),
			fixtureCode,
			f.verifier,
			fixtureNonce,
			issuer,
		); err == nil {
			t.Error("exchange accepted a missing or incorrect response issuer")
		}
	}

	profile, err := p.Exchange(t.Context(), fixtureCode, f.verifier, fixtureNonce, &f.issuer)
	if err != nil {
		t.Fatal(err)
	}

	if profile.Email != fixtureEmail || !profile.EmailVerified.IsVerified() ||
		profile.ProviderUserID != fixtureSubject {
		t.Errorf("unexpected profile: %+v", profile)
	}

	if f.discoveryCalls.Load() != 1 || f.tokenCalls.Load() != 1 || f.keyCalls.Load() != 1 {
		t.Error("discovery should be reused and invalid issuers should not be exchanged")
	}
}

func assertAuthorizationURL(t *testing.T, location, verifier string) {
	t.Helper()

	authorizationURL, err := url.Parse(location)
	if err != nil {
		t.Fatal(err)
	}

	for key, want := range map[string]string{
		"client_id": "web", "state": "signed-state", "nonce": fixtureNonce,
		"response_type": "code", "scope": "openid email profile", "code_challenge_method": "S256",
		"code_challenge": oauth2.S256ChallengeFromVerifier(verifier),
	} {
		if got := authorizationURL.Query().Get(key); got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
}

func TestOIDCRejectsDifferentUserInfoSubject(t *testing.T) {
	t.Parallel()

	f := newOIDCFixture(t, true)
	if _, err := f.registry(t).Get("first").Exchange(
		t.Context(), fixtureCode, f.verifier, fixtureNonce, &f.issuer,
	); !errors.Is(err, errIDToken) {
		t.Fatalf("expected UserInfo subject rejection, got %v", err)
	}
}

func TestOIDCNativeClaims(t *testing.T) {
	t.Parallel()

	f := newOIDCFixture(t, false)
	p := f.registry(t).Get("first")
	nonce := "native-nonce"
	nonceHash := sha256.Sum256([]byte(nonce))
	digest := hex.EncodeToString(nonceHash[:])

	for _, tc := range []struct {
		name   string
		mutate func(jwt.MapClaims)
	}{
		{name: "wrong issuer", mutate: func(c jwt.MapClaims) { c["iss"] = strings.TrimSuffix(f.issuer, "/") }},
		{name: "wrong audience", mutate: func(c jwt.MapClaims) { c["aud"] = "web" }},
		{name: "extra untrusted audience", mutate: func(c jwt.MapClaims) { c["aud"] = []string{"mobile", "other"}; c["azp"] = "mobile" }},
		{name: "missing authorized party", mutate: func(c jwt.MapClaims) { c["aud"] = []string{"mobile", "desktop"} }},
		{name: "wrong authorized party", mutate: func(c jwt.MapClaims) { c["azp"] = "desktop" }},
		{name: "missing nonce", mutate: func(c jwt.MapClaims) { delete(c, "nonce") }},
		{name: "wrong nonce", mutate: func(c jwt.MapClaims) { c["nonce"] = nonce }},
		{name: "missing subject", mutate: func(c jwt.MapClaims) { delete(c, "sub") }},
		{name: "missing issue time", mutate: func(c jwt.MapClaims) { delete(c, "iat") }},
		{name: "future issue time", mutate: func(c jwt.MapClaims) { c["iat"] = time.Now().Add(time.Minute).Unix() }},
		{name: "missing expiration", mutate: func(c jwt.MapClaims) { delete(c, "exp") }},
		{name: "expired", mutate: func(c jwt.MapClaims) {
			c["iat"] = time.Now().Add(-time.Hour).Unix()
			c["exp"] = time.Now().Add(-time.Minute).Unix()
		}},
		{name: "string verification", mutate: func(c jwt.MapClaims) { c["email_verified"] = "true" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			claims := f.claims("mobile", digest)
			tc.mutate(claims)

			token, err := f.sign(claims, "key-1")
			if err != nil {
				t.Fatal(err)
			}

			if _, err := p.VerifyNative(t.Context(), token, nonce); !errors.Is(err, errIDToken) {
				t.Fatalf("expected invalid token, got %v", err)
			}
		})
	}

	claims := f.claims("mobile", digest)
	delete(claims, "email_verified")

	token, err := f.sign(claims, "key-1")
	if err != nil {
		t.Fatal(err)
	}

	profile, err := p.VerifyNative(t.Context(), token, nonce)
	if err != nil || profile.EmailVerified != EmailVerificationStatusUnknown ||
		profile.ProviderUserID != fixtureSubject {
		t.Fatalf(
			"expected validated profile with unknown email verification, got %+v, %v",
			profile,
			err,
		)
	}

	parts := strings.Split(token, ".")
	if _, err := p.VerifyNative(t.Context(), parts[0]+"."+parts[1]+".AAAA", nonce); err == nil {
		t.Error("accepted an invalid signature")
	}

	hmac := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := hmac.SignedString([]byte("fixture-not-a-signing-key"))
	if err != nil {
		t.Fatal(err)
	}

	if _, err := p.VerifyNative(t.Context(), signed, nonce); err == nil {
		t.Error("accepted a symmetric signature advertised in discovery")
	}
}

func TestOIDCCachesAndRefreshesKeys(t *testing.T) {
	t.Parallel()

	f := newOIDCFixture(t, false)
	p := f.registry(t).Get("first")
	hash := sha256.Sum256([]byte(fixtureNonce))
	claims := f.claims("mobile", hex.EncodeToString(hash[:]))

	verify := func(kid string) error {
		t.Helper()

		token, err := f.sign(claims, kid)
		if err != nil {
			t.Fatal(err)
		}

		_, err = p.VerifyNative(t.Context(), token, fixtureNonce)

		return err
	}

	f.failDiscovery.Store(true)

	if err := verify("key-1"); err == nil {
		t.Fatal("expected initial discovery failure")
	}

	if err := verify("key-1"); err == nil || f.discoveryCalls.Load() != 1 {
		t.Fatal("discovery failure should be cached")
	}

	f.failDiscovery.Store(false)

	p.discovery.retryAfter = time.Time{}

	if err := verify("key-1"); err != nil {
		t.Fatal(err)
	}

	f.keyID.Store(new("key-2"))

	if err := verify("key-2"); err == nil || f.keyCalls.Load() != 1 {
		t.Fatal("unknown key refresh should be rate limited")
	}

	p.keys.retryAfter = time.Time{}

	if err := verify("key-2"); err != nil || f.keyCalls.Load() != 2 {
		t.Fatalf("rotated key should be used after refresh, got %v", err)
	}

	if err := verify("key-1"); err == nil {
		t.Fatal("retired key accepted after refresh")
	}

	p.keys.expiresAt = time.Time{}

	if err := verify("key-2"); err == nil {
		t.Fatal("expired key set accepted during cooldown")
	}

	p.keys.retryAfter = time.Time{}

	if err := verify("key-2"); err != nil || f.keyCalls.Load() != 3 {
		t.Fatalf("expired key set should be refreshed, got %v", err)
	}
}

type oidcMetadataTransport func(*http.Request) (*http.Response, error)

func (f oidcMetadataTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestOIDCMetadataCooldownSurvivesCancellation(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		load func(context.Context, *CustomProvider) error
	}{
		{
			name: "discovery",
			load: func(ctx context.Context, p *CustomProvider) error {
				_, err := p.discover(ctx)
				return err
			},
		},
		{
			name: "JWKS",
			load: func(ctx context.Context, p *CustomProvider) error {
				doc := &discoveryDocument{JWKSURI: "https://issuer.example/keys"}
				_, err := p.signingKey(ctx, doc, jwt.New(jwt.SigningMethodRS256))

				return err
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()

			calls := 0
			transport := func(req *http.Request) (*http.Response, error) {
				calls++

				cancel()

				if req.Context().Err() != nil {
					t.Error("cancelling the caller cancelled a shared metadata refresh")
				}

				if _, ok := req.Context().Deadline(); !ok {
					t.Error("expected a deadline for the metadata refresh")
				}

				response := httptest.NewRecorder()
				response.WriteHeader(http.StatusServiceUnavailable)

				return response.Result(), nil
			}
			f := &oidcFixture{
				issuer: "https://issuer.example",
				client: &http.Client{Transport: oidcMetadataTransport(transport)},
			}

			p := f.registry(t).Get("first")
			if err := tc.load(ctx, p); err == nil {
				t.Fatal("metadata provider was unavailable")
			}

			if err := tc.load(t.Context(), p); err == nil || calls != 1 {
				t.Fatalf("expected a refresh cooldown after %d requests, got %v", calls, err)
			}
		})
	}
}

func TestOIDCRegistryRejectsInvalidConfiguration(t *testing.T) {
	t.Parallel()

	valid := `{"slug":"provider","issuer":"https://idp.example","clientId":"web","clientSecret":"sensitive-value"}`
	for _, raw := range []string{
		"null", "{}", "[" + valid + "," + valid + "]",
		"[" + strings.Replace(valid, "https://", "http://", 1) + "]",
		"[" + strings.Replace(valid, "idp.example", "idp.example?q=1", 1) + "]",
		"[" + strings.Replace(valid, "idp.example", "user@idp.example", 1) + "]",
		"[" + strings.Replace(valid, `"slug":"provider"`, `"slug":"OIDC:provider"`, 1) + "]",
		"[" + strings.Replace(valid, `"slug":"provider"`, `"slug":"provider","slug":"other"`, 1) + "]",
		"[" + strings.TrimSuffix(valid, "}") + `,"unknown":true}]`,
		"[" + strings.TrimSuffix(valid, "}") + `,"scopes":["email"]}]`,
	} {
		serverURL, err := url.Parse("https://auth.example.com/v1")
		if err != nil {
			t.Fatal(err)
		}

		if _, err := NewOIDCRegistry(raw, serverURL, &http.Client{}); err == nil ||
			strings.Contains(err.Error(), "sensitive-value") {
			t.Errorf("expected sanitized configuration error, got %v", err)
		}
	}
}

func TestOIDCDiscoveryUsesHardenedClient(t *testing.T) {
	t.Parallel()

	f := newOIDCFixture(t, false)
	f.client = safehttp.New(safehttp.Config{
		PublicIPsOnly: true,
	})

	p := f.registry(t).Get("first")
	if _, err := p.AuthorizationURL(t.Context(), "state", fixtureNonce, f.verifier); err == nil {
		t.Fatal("hardened client allowed a request to a loopback issuer")
	}

	if f.discoveryCalls.Load() != 0 {
		t.Fatal("request reached the loopback fixture")
	}
}

func TestOIDCDiscoveryRejectsInvalidMetadata(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name  string
		field string
		value any
	}{
		{name: "missing issuer", field: "issuer", value: ""},
		{name: "wrong issuer", field: "issuer", value: "https://other.example"},
		{name: "non-HTTPS authorization", field: "authorization_endpoint", value: "http://idp.example/authorize"},
		{name: "authorization parameter collision", field: "authorization_endpoint", value: "https://idp.example/authorize?nonce=unexpected"},
		{name: "relative token endpoint", field: "token_endpoint", value: "/token"},
		{name: "credential in JWKS URL", field: "jwks_uri", value: "https://user@idp.example/jwks"},
		{name: "fragment in UserInfo URL", field: "userinfo_endpoint", value: "https://idp.example/userinfo#fragment"},
		{name: "symmetric signing only", field: "id_token_signing_alg_values_supported", value: []string{"HS256"}},
		{name: "unsupported token auth", field: "token_endpoint_auth_methods_supported", value: []string{"none"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewTLSServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					issuer := "https://" + r.Host
					doc := map[string]any{
						"issuer": issuer, "authorization_endpoint": issuer + "/authorize",
						"token_endpoint": issuer + "/token", "jwks_uri": issuer + "/jwks",
						"id_token_signing_alg_values_supported": []string{"RS256"},
					}
					doc[tc.field] = tc.value
					writeFixtureJSON(t, w, doc)
				}),
			)
			t.Cleanup(server.Close)

			f := &oidcFixture{issuer: server.URL, client: server.Client()}

			p := f.registry(t).Get("first")
			if _, err := p.AuthorizationURL(
				t.Context(), "signed-state", fixtureNonce, oauth2.GenerateVerifier(),
			); !errors.Is(err, errDiscovery) {
				t.Fatalf("expected invalid metadata error, got %v", err)
			}
		})
	}
}
