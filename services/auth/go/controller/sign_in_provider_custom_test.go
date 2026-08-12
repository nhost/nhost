package controller_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

// customTestIDP is an in-process TLS OIDC IdP for driving the custom
// provider browser flow: discovery, JWKS, and a token endpoint that mints
// RS256 id_tokens embedding the configured nonce claim.
type customTestIDP struct {
	server *httptest.Server
	key    *rsa.PrivateKey

	mu    sync.Mutex
	nonce string // nonce claim embedded in minted id_tokens; "" omits it
	// omitProfileClaims mints id_tokens carrying only the identity claims,
	// like the IdPs that expose the profile from the userinfo endpoint only.
	omitProfileClaims bool
	// audience overrides the aud claim of minted id_tokens; "" means the
	// confidential client id.
	audience string
	// userinfoSub overrides the sub the userinfo endpoint reports; "" means
	// the same subject the id_token carries.
	userinfoSub string
	// omitIDToken drops id_token from the token response — the only shape in
	// which callbackIDToken consults the caller's copy.
	omitIDToken bool
}

func newCustomTestIDP(t *testing.T) *customTestIDP {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	idp := &customTestIDP{
		key: key,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", idp.handleDiscovery)
	mux.HandleFunc("/jwks.json", idp.handleJWKS)
	mux.HandleFunc("/token", idp.handleToken)
	mux.HandleFunc("/userinfo", idp.handleUserinfo)

	idp.server = httptest.NewTLSServer(mux)
	t.Cleanup(idp.server.Close)

	return idp
}

func (f *customTestIDP) URL() string {
	return f.server.URL
}

func (f *customTestIDP) SetNonceClaim(nonce string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.nonce = nonce
}

// SetOmitProfileClaims makes minted id_tokens carry sub but no email, name or
// picture, so the profile has to come from the userinfo endpoint.
func (f *customTestIDP) SetOmitProfileClaims(omit bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.omitProfileClaims = omit
}

// SetAudience mints id_tokens for a different client than the confidential
// one — the shape a public/native app client produces.
func (f *customTestIDP) SetAudience(audience string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.audience = audience
}

// SetUserinfoSub makes the userinfo endpoint describe a different subject
// than the id_token, the mismatch OIDC Core §5.3.2 requires us to reject.
func (f *customTestIDP) SetUserinfoSub(sub string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.userinfoSub = sub
}

// SetOmitIDToken makes the token endpoint answer without an id_token, which is
// what reaches callbackIDToken's second branch.
func (f *customTestIDP) SetOmitIDToken(omit bool) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.omitIDToken = omit
}

func (f *customTestIDP) handleDiscovery(w http.ResponseWriter, _ *http.Request) {
	doc := map[string]any{
		"issuer":                 f.server.URL,
		"authorization_endpoint": f.server.URL + "/authorize",
		"token_endpoint":         f.server.URL + "/token",
		"jwks_uri":               f.server.URL + "/jwks.json",
		"userinfo_endpoint":      f.server.URL + "/userinfo",
	}

	if err := json.NewEncoder(w).Encode(doc); err != nil {
		panic(err)
	}
}

func (f *customTestIDP) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	pub := &f.key.PublicKey

	jwks := map[string]any{
		"keys": []map[string]any{{
			"kty": "RSA",
			"kid": "test-key",
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

// handleUserinfo serves the profile an IdP withholds from the id_token. It
// requires the access token from the code exchange: the fallback must
// authenticate, never fetch an unauthenticated profile.
func (f *customTestIDP) handleUserinfo(w http.ResponseWriter, r *http.Request) {
	if got := r.Header.Get("Authorization"); got != "Bearer idp-access-token" {
		w.WriteHeader(http.StatusUnauthorized)

		return
	}

	f.mu.Lock()
	sub := f.userinfoSub
	f.mu.Unlock()

	if sub == "" {
		sub = "custom-user-1"
	}

	body := map[string]any{
		"email":          "jane@example.com",
		"email_verified": true,
		"name":           "Jane",
		"picture":        "https://example.com/jane.jpg",
	}

	// "-" is the sentinel for a response that omits sub entirely.
	if sub != "-" {
		body["sub"] = sub
	}

	if err := json.NewEncoder(w).Encode(body); err != nil {
		panic(err)
	}
}

// MintIDToken signs claims with the IdP's own key, so a test can produce a
// token that passes every validation the callback applies — signature, issuer,
// audience, nonce — while describing a different subject than the code
// exchange does.
func (f *customTestIDP) MintIDToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	signed, err := token.SignedString(f.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

func (f *customTestIDP) handleToken(w http.ResponseWriter, _ *http.Request) {
	f.mu.Lock()
	nonce := f.nonce
	omitProfileClaims := f.omitProfileClaims
	audience := f.audience
	omitIDToken := f.omitIDToken
	f.mu.Unlock()

	if audience == "" {
		audience = "client-id"
	}

	claims := jwt.MapClaims{
		"iss": f.server.URL,
		"aud": audience,
		"sub": "custom-user-1",
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Hour).Unix(),
	}

	if !omitProfileClaims {
		claims["email"] = "jane@example.com"
		claims["email_verified"] = true
		claims["name"] = "Jane"
		claims["picture"] = "https://example.com/jane.jpg"
	}

	if nonce != "" {
		claims["nonce"] = nonce
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	signed, err := token.SignedString(f.key)
	if err != nil {
		panic(err)
	}

	w.Header().Set("Content-Type", "application/json")

	body := map[string]any{
		"access_token": "idp-access-token",
		"token_type":   "Bearer",
		"expires_in":   3600,
	}

	if !omitIDToken {
		body["id_token"] = signed
	}

	if err := json.NewEncoder(w).Encode(body); err != nil {
		panic(err)
	}
}

// customProviderOpts are the AUTH_PROVIDER_CUSTOM fields a test varies.
// disableNonce has two consumers — the built provider and
// Config.CustomProviders — so they travel together.
type customProviderOpts struct {
	audiences    []string
	disableNonce bool
}

// buildCustomTestProvider decodes and builds a c:test OIDC provider pointed
// at the fixture IdP, exactly like the startup registry does.
func buildCustomTestProvider(t *testing.T, idp *customTestIDP) *providers.Provider {
	t.Helper()

	provider, _ := buildCustomTestProviderWithOpts(t, idp, customProviderOpts{})

	return provider
}

// buildCustomTestProviderWithOpts also returns the native validator the registry
// hands to the id_token endpoints — deliberately not the browser one. The options
// go through the JSON, so the decode step is exercised too.
func buildCustomTestProviderWithOpts(
	t *testing.T, idp *customTestIDP, opts customProviderOpts,
) (*providers.Provider, *oidc.LazyIDTokenValidator) {
	t.Helper()

	audiencesJSON, err := json.Marshal(opts.audiences)
	if err != nil {
		t.Fatalf("failed to marshal audiences: %v", err)
	}

	raw := fmt.Sprintf(`{
		"test": {
			"type": "oidc",
			"clientId": "client-id",
			"clientSecret": "client-secret",
			"issuer": %q,
			"audiences": %s,
			"disableNonce": %t
		}
	}`, idp.URL(), audiencesJSON, opts.disableNonce)

	defs, invalid, err := providers.DecodeDefinitions(
		[]byte(raw), "https://local.auth.nhost.run", false,
	)
	if err != nil || len(invalid) > 0 {
		t.Fatalf("failed to decode definitions: %v %v", err, invalid)
	}

	client := safehttp.New(safehttp.Config{AllowPrivateIPs: true, InsecureSkipTLSVerify: true})

	provider, validator, err := defs["test"].Build(t.Context(), client)
	if err != nil {
		t.Fatalf("failed to build provider: %v", err)
	}

	return provider, validator
}

func customFlowConfig(idp *customTestIDP) func() *controller.Config {
	return customFlowConfigWithOpts(idp, customProviderOpts{})
}

// customFlowConfigWithOpts is the Config half of customProviderOpts — the
// registry entry cmd/custom_oauth.go derives from the same definition.
func customFlowConfigWithOpts(
	idp *customTestIDP, opts customProviderOpts,
) func() *controller.Config {
	return func() *controller.Config {
		cfg := getConfig()
		cfg.CustomProviders = map[string]controller.CustomProviderConfig{
			"c:test": {Issuer: idp.URL(), NonceDisabled: opts.disableNonce},
		}

		return cfg
	}
}

// signInAndParseAuthURL drives SignInProvider for c:test and returns the
// parsed authorize URL.
func signInAndParseAuthURL(
	t *testing.T, c *controller.Controller,
) *url.URL {
	t.Helper()

	return signInAndParseAuthURLFor(t, c, "c:test")
}

// signInAndParseAuthURLFor is signInAndParseAuthURL for a named provider: the
// state JWT carries no provider identifier, so a state minted here is usable at
// any provider's callback.
func signInAndParseAuthURLFor(
	t *testing.T, c *controller.Controller, provider string,
) *url.URL {
	t.Helper()

	resp, err := c.SignInProvider(t.Context(), api.SignInProviderRequestObject{
		Params:   api.SignInProviderParams{},
		Provider: provider,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	redirect, ok := resp.(api.SignInProvider302Response)
	if !ok {
		t.Fatalf("expected 302 response, got %T: %v", resp, resp)
	}

	authURL, err := url.Parse(redirect.Headers.Location)
	if err != nil {
		t.Fatalf("failed to parse authorize URL: %v", err)
	}

	return authURL
}

// expectCustomProviderSignup sets up the sign-up expectations of the c:test
// browser flow: neither the provider identity nor the email is known, so a new
// user is inserted with the issuer recorded.
func expectCustomProviderSignup(
	db *mock.MockDBClient, idp *customTestIDP, userID, refreshTokenID uuid.UUID,
) {
	db.EXPECT().GetUserByProviderID(
		gomock.Any(),
		sql.GetUserByProviderIDParams{
			ProviderID:     "c:test",
			ProviderUserID: "custom-user-1",
		},
	).Return(sql.AuthUser{}, pgx.ErrNoRows)

	db.EXPECT().GetUserByEmail(
		gomock.Any(),
		sql.Text("jane@example.com"),
	).Return(sql.AuthUser{}, pgx.ErrNoRows)

	db.EXPECT().InsertUserWithUserProviderAndRefreshToken(
		gomock.Any(),
		cmpDBParams(
			sql.InsertUserWithUserProviderAndRefreshTokenParams{
				ID:               userID,
				Disabled:         false,
				DisplayName:      "Jane",
				AvatarUrl:        "https://example.com/jane.jpg",
				Email:            sql.Text("jane@example.com"),
				Ticket:           sql.Text(""),
				TicketExpiresAt:  sql.TimestampTz(time.Now()),
				EmailVerified:    true,
				Locale:           "en",
				DefaultRole:      "user",
				Metadata:         []byte("null"),
				Roles:            []string{"user", "me"},
				RefreshTokenHash: sql.Text("asdadasdasdasd"),
				RefreshTokenExpiresAt: sql.TimestampTz(
					time.Now().Add(30 * 24 * time.Hour),
				),
				ProviderID:     "c:test",
				ProviderUserID: "custom-user-1",
				Issuer:         sql.Text(idp.URL()),
			},
			cmpopts.IgnoreFields(
				sql.InsertUserWithUserProviderAndRefreshTokenParams{},
				"ID",
			),
		),
	).Return(sql.InsertUserWithUserProviderAndRefreshTokenRow{
		ID:             userID,
		RefreshTokenID: refreshTokenID,
	}, nil)

	db.EXPECT().UpdateProviderSession(
		gomock.Any(),
		gomock.Any(),
	).Return(nil)
}

// completeCustomCallback echoes the nonce from the authorize request into the
// id_tokens the IdP mints — as a compliant OIDC provider does — and drives the
// c:test callback, asserting it ends in a refresh-token redirect.
func completeCustomCallback(
	t *testing.T, c *controller.Controller, idp *customTestIDP, authURL *url.URL,
) {
	t.Helper()

	idp.SetNonceClaim(authURL.Query().Get("nonce"))

	resp, err := c.SignInProviderCallbackGet(
		t.Context(), api.SignInProviderCallbackGetRequestObject{
			Params: api.SignInProviderCallbackGetParams{
				Code:  ptr("test-code"),
				State: authURL.Query().Get("state"),
			},
			Provider: "c:test",
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	redirect, ok := resp.(api.SignInProviderCallbackGet302Response)
	if !ok {
		t.Fatalf("expected 302 response, got %T: %v", resp, resp)
	}

	matched, err := regexp.MatchString(
		`^http://localhost:3000\?refreshToken=[\w-]+$`,
		redirect.Headers.Location,
	)
	if err != nil || !matched {
		t.Errorf("unexpected callback redirect: %q", redirect.Headers.Location)
	}
}

func TestSignInProviderCustomOIDCBrowserFlow(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	t.Run("full nonce round-trip signs up", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)
		expectCustomProviderSignup(db, idp, userID, refreshTokenID)

		c, _ := getController(
			t, ctrl, customFlowConfig(idp),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signInAndParseAuthURL(t, c)

		if !strings.HasPrefix(authURL.String(), idp.URL()+"/authorize") {
			t.Fatalf("expected authorize URL at the IdP, got %q", authURL)
		}

		query := authURL.Query()

		if got := query.Get("client_id"); got != "client-id" {
			t.Errorf("unexpected client_id: %q", got)
		}

		wantRedirectURI := "https://local.auth.nhost.run/signin/provider/c:test/callback"
		if got := query.Get("redirect_uri"); got != wantRedirectURI {
			t.Errorf("unexpected redirect_uri: %q", got)
		}

		if got := query.Get("scope"); !strings.Contains(got, "openid") {
			t.Errorf("expected openid scope, got %q", got)
		}

		if nonceParam := query.Get("nonce"); !regexp.MustCompile(
			`^[0-9a-f]{64}$`,
		).MatchString(nonceParam) {
			t.Fatalf("expected hex-encoded sha256 nonce, got %q", nonceParam)
		}

		completeCustomCallback(t, c, idp, authURL)
	})

	t.Run("id_token without profile claims falls back to userinfo", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		// The IdP mints an id_token with sub only; email, email_verified,
		// name and picture have to come from the discovered userinfo
		// endpoint, authenticated with the exchanged access token.
		idp.SetOmitProfileClaims(true)

		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)

		// The same expectations as the id_token-carried profile: the filled
		// email is what the user is signed up with, and EmailVerified: true
		// comes from the userinfo claim — the flag that gates linking.
		expectCustomProviderSignup(db, idp, userID, refreshTokenID)

		c, _ := getController(
			t, ctrl, customFlowConfig(idp),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		completeCustomCallback(t, c, idp, signInAndParseAuthURL(t, c))
	})
}

// TestSignUpProviderCustomOIDCBrowserFlow covers the /signup/provider entry
// point: SignUpProvider gained the same nonce call as SignInProvider, and the
// FlowSignup branch of the callback records the issuer just like the signin
// branch. Both were previously exercised for zero custom providers.
func TestSignUpProviderCustomOIDCBrowserFlow(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	signUpAuthURL := func(t *testing.T, c *controller.Controller) *url.URL {
		t.Helper()

		resp, err := c.SignUpProvider(t.Context(), api.SignUpProviderRequestObject{
			Params:   api.SignUpProviderParams{},
			Provider: "c:test",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirect, ok := resp.(api.SignUpProvider302Response)
		if !ok {
			t.Fatalf("expected 302 response, got %T: %v", resp, resp)
		}

		authURL, err := url.Parse(redirect.Headers.Location)
		if err != nil {
			t.Fatalf("failed to parse authorize URL: %v", err)
		}

		return authURL
	}

	t.Run("signup flow signs up with the issuer recorded", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)
		expectCustomProviderSignup(db, idp, userID, refreshTokenID)

		c, _ := getController(
			t, ctrl, customFlowConfig(idp),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signUpAuthURL(t, c)

		if nonceParam := authURL.Query().Get("nonce"); !regexp.MustCompile(
			`^[0-9a-f]{64}$`,
		).MatchString(nonceParam) {
			t.Fatalf("expected the signup authorize URL to carry a nonce, got %q", nonceParam)
		}

		completeCustomCallback(t, c, idp, authURL)
	})

	// SignUpProvider builds its own state and calls nonceForProvider itself,
	// so the flag has to be honoured here independently of SignInProvider.
	t.Run("signup flow with the nonce disabled", func(t *testing.T) {
		t.Parallel()

		nonceDisabled := customProviderOpts{disableNonce: true}

		idp := newCustomTestIDP(t)
		provider, _ := buildCustomTestProviderWithOpts(t, idp, nonceDisabled)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)
		expectCustomProviderSignup(db, idp, userID, refreshTokenID)

		c, _ := getController(
			t, ctrl, customFlowConfigWithOpts(idp, nonceDisabled),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signUpAuthURL(t, c)

		if authURL.Query().Has("nonce") {
			t.Errorf(
				"a nonce-disabled provider must not receive a nonce parameter: %q",
				authURL,
			)
		}

		// The IdP returns no nonce claim at all — the LinkedIn shape.
		idp.SetNonceClaim("")

		resp, err := c.SignInProviderCallbackGet(
			t.Context(), api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{
					Code:  ptr("test-code"),
					State: authURL.Query().Get("state"),
				},
				Provider: "c:test",
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if _, ok := resp.(api.SignInProviderCallbackGet302Response); !ok {
			t.Fatalf("expected the signup to succeed, got %T: %v", resp, resp)
		}
	})

	t.Run("signup flow refuses an existing email", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)

		db.EXPECT().GetUserByProviderID(
			gomock.Any(),
			sql.GetUserByProviderIDParams{
				ProviderID:     "c:test",
				ProviderUserID: "custom-user-1",
			},
		).Return(sql.AuthUser{}, pgx.ErrNoRows)

		db.EXPECT().GetUserByEmail(
			gomock.Any(),
			sql.Text("jane@example.com"),
		).Return(customIDTokenUser(userID), nil)

		// The account holds no c:test identity, so the cross-provider guard
		// refuses before the signup-intent check even reports the conflict.
		db.EXPECT().GetUserProviderIDsByUserID(
			gomock.Any(), userID,
		).Return([]string{"github"}, nil)

		c, _ := getController(
			t, ctrl, customFlowConfig(idp),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signUpAuthURL(t, c)
		idp.SetNonceClaim(authURL.Query().Get("nonce"))

		resp, err := c.SignInProviderCallbackGet(
			t.Context(), api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{
					Code:  ptr("test-code"),
					State: authURL.Query().Get("state"),
				},
				Provider: "c:test",
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirect, ok := resp.(controller.ErrorRedirectResponse)
		if !ok {
			t.Fatalf("expected an error redirect, got %T: %v", resp, resp)
		}

		if !strings.Contains(redirect.Headers.Location, "error=user-already-exists") {
			t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
		}
	})
}

// TestSignInProviderCustomNativeAudienceIsBrowserOnlyRejected pins the split
// between the two validators an OIDC-type custom provider builds.
//
// The configured `audiences` name a tenant's public/native app clients. An
// attacker can have such a client mint an id_token for a victim with a nonce
// of their choosing, and the browser callback prefers a caller-supplied
// id_token query parameter over the one from the token exchange — with the
// raw nonce readable from the signed-but-not-encrypted state JWT. So the
// browser flow must accept the confidential client id and nothing else,
// while POST /signin/idtoken accepts the configured audiences.
func TestSignInProviderCustomNativeAudienceIsBrowserOnlyRejected(t *testing.T) {
	t.Parallel()

	const nativeAudience = "native-app-client-id"

	idp := newCustomTestIDP(t)
	idp.SetAudience(nativeAudience)

	provider, nativeValidator := buildCustomTestProviderWithOpts(
		t, idp, customProviderOpts{audiences: []string{nativeAudience}},
	)

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	db := mock.NewMockDBClient(ctrl)

	c, _ := getController(
		t, ctrl, customFlowConfig(idp),
		func(*gomock.Controller) controller.DBClient { return db },
		withExtraProviders(providers.Map{"c:test": provider}),
	)

	authURL := signInAndParseAuthURL(t, c)
	query := authURL.Query()

	idp.SetNonceClaim(query.Get("nonce"))

	resp, err := c.SignInProviderCallbackGet(
		t.Context(), api.SignInProviderCallbackGetRequestObject{
			Params: api.SignInProviderCallbackGetParams{
				Code:  ptr("test-code"),
				State: query.Get("state"),
			},
			Provider: "c:test",
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	redirect, ok := resp.(controller.ErrorRedirectResponse)
	if !ok {
		t.Fatalf("expected the browser callback to reject the native audience, got %T", resp)
	}

	if !strings.Contains(redirect.Headers.Location, "error=oauth-profile-fetch-failed") {
		t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
	}

	// The very same token is valid on the native path.
	validator, err := nativeValidator.Get(t.Context())
	if err != nil {
		t.Fatalf("failed to build the native validator: %v", err)
	}

	nativeToken := mintCustomIDPToken(t, idp, jwt.MapClaims{
		"iss": idp.URL(),
		"aud": nativeAudience,
		"sub": "custom-user-1",
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	if _, err := validator.Validate(nativeToken, ""); err != nil {
		t.Errorf("expected /signin/idtoken to accept the configured audience: %v", err)
	}
}

// mintCustomIDPToken signs claims with the fixture IdP's key.
func mintCustomIDPToken(t *testing.T, idp *customTestIDP, claims jwt.MapClaims) string {
	t.Helper()

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	signed, err := token.SignedString(idp.key)
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	return signed
}

// TestSignInProviderCustomUserinfoSubjectMismatch pins OIDC Core §5.3.2: the
// id_token fixes the identity while the access token decides whose claims
// userinfo returns, and the callback lets a caller compose the two. Merging a
// mismatched email would hand the attacker's provider identity a verified
// claim on the victim's address, which is the only thing
// ensureProviderLinkAllowed checks.
func TestSignInProviderCustomUserinfoSubjectMismatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		userinfoSub string
	}{
		{name: "different subject", userinfoSub: "someone-else"},
		{name: "absent subject", userinfoSub: "-"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newCustomTestIDP(t)
			idp.SetOmitProfileClaims(true)
			idp.SetUserinfoSub(tc.userinfoSub)

			provider := buildCustomTestProvider(t, idp)

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			db := mock.NewMockDBClient(ctrl)

			c, _ := getController(
				t, ctrl, customFlowConfig(idp),
				func(*gomock.Controller) controller.DBClient { return db },
				withExtraProviders(providers.Map{"c:test": provider}),
			)

			authURL := signInAndParseAuthURL(t, c)
			query := authURL.Query()

			idp.SetNonceClaim(query.Get("nonce"))

			resp, err := c.SignInProviderCallbackGet(
				t.Context(), api.SignInProviderCallbackGetRequestObject{
					Params: api.SignInProviderCallbackGetParams{
						Code:  ptr("test-code"),
						State: query.Get("state"),
					},
					Provider: "c:test",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			redirect, ok := resp.(controller.ErrorRedirectResponse)
			if !ok {
				t.Fatalf("expected the mismatched userinfo to fail, got %T: %v", resp, resp)
			}

			if !strings.Contains(
				redirect.Headers.Location, "error=oauth-profile-fetch-failed",
			) {
				t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
			}
		})
	}
}

// TestSignInProviderCustomIgnoresCallerSuppliedIDToken pins the trust order on
// the value that establishes identity for the whole browser flow: the id_token
// from the code exchange, not the one the caller put in the query string.
//
// The injected token here passes every check the callback applies — it is
// signed by the IdP's own key, with the configured issuer, the confidential
// client's audience and the nonce bound to this very state — and describes a
// different subject. That is the shape an attacker gets when the tenant's
// clientId is reachable as a public client: they would replay it alongside
// their own fresh code. The signup expectations name custom-user-1, so any
// leakage of the injected subject fails as an unexpected mock call.
func TestSignInProviderCustomIgnoresCallerSuppliedIDToken(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	idp := newCustomTestIDP(t)
	provider := buildCustomTestProvider(t, idp)

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	db := mock.NewMockDBClient(ctrl)
	expectCustomProviderSignup(db, idp, userID, refreshTokenID)

	c, _ := getController(
		t, ctrl, customFlowConfig(idp),
		func(*gomock.Controller) controller.DBClient { return db },
		withExtraProviders(providers.Map{"c:test": provider}),
	)

	authURL := signInAndParseAuthURL(t, c)
	query := authURL.Query()

	nonce := query.Get("nonce")
	idp.SetNonceClaim(nonce)

	victimToken := idp.MintIDToken(t, jwt.MapClaims{
		"iss":            idp.URL(),
		"aud":            "client-id",
		"sub":            "victim-user",
		"email":          "victim@example.com",
		"email_verified": true,
		"name":           "Victim",
		"nonce":          nonce,
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	})

	resp, err := c.SignInProviderCallbackGet(
		t.Context(), api.SignInProviderCallbackGetRequestObject{
			Params: api.SignInProviderCallbackGetParams{
				Code:    ptr("test-code"),
				State:   query.Get("state"),
				IdToken: ptr(victimToken),
			},
			Provider: "c:test",
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := resp.(api.SignInProviderCallbackGet302Response); !ok {
		t.Fatalf("expected the exchange's identity to sign up, got %T: %v", resp, resp)
	}
}

func TestSignInProviderCustomOIDCNonceRejections(t *testing.T) {
	t.Parallel()

	badNonceCases := []struct {
		name  string
		nonce func(nonceParam string) string
	}{
		{
			name:  "id_token with wrong nonce is rejected",
			nonce: func(string) string { return "0000000000000000" },
		},
		{
			name:  "id_token without nonce claim is rejected",
			nonce: func(string) string { return "" },
		},
	}

	for _, tc := range badNonceCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newCustomTestIDP(t)
			provider := buildCustomTestProvider(t, idp)

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			db := mock.NewMockDBClient(ctrl)

			c, _ := getController(
				t, ctrl, customFlowConfig(idp),
				func(*gomock.Controller) controller.DBClient { return db },
				withExtraProviders(providers.Map{"c:test": provider}),
			)

			authURL := signInAndParseAuthURL(t, c)
			query := authURL.Query()

			idp.SetNonceClaim(tc.nonce(query.Get("nonce")))

			resp, err := c.SignInProviderCallbackGet(
				t.Context(), api.SignInProviderCallbackGetRequestObject{
					Params: api.SignInProviderCallbackGetParams{
						Code:  ptr("test-code"),
						State: query.Get("state"),
					},
					Provider: "c:test",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			redirect, ok := resp.(controller.ErrorRedirectResponse)
			if !ok {
				t.Fatalf("expected error redirect, got %T: %v", resp, resp)
			}

			if !strings.Contains(
				redirect.Headers.Location, "error=oauth-profile-fetch-failed",
			) {
				t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
			}
		})
	}

	t.Run("state without nonce is rejected", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)

		c, jwtGetter := getController(
			t, ctrl, customFlowConfig(idp),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		// A state minted without a nonce claim — as if the authorization
		// request had been forged to skip nonce binding.
		state := getState(t, jwtGetter, nil, api.SignUpOptions{})

		idp.SetNonceClaim("whatever")

		resp, err := c.SignInProviderCallbackGet(
			t.Context(), api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{
					Code:  ptr("test-code"),
					State: state,
				},
				Provider: "c:test",
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirect, ok := resp.(controller.ErrorRedirectResponse)
		if !ok {
			t.Fatalf("expected error redirect, got %T: %v", resp, resp)
		}

		if !strings.Contains(
			redirect.Headers.Location, "error=oauth-profile-fetch-failed",
		) {
			t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
		}
	})
}

// TestSignInProviderCustomOIDCNonceDisabled pins the browser half of the opt-out
// end to end: the flag survives the decode, suppresses the nonce on the authorize
// request, and relaxes the id_token check on the way back.
func TestSignInProviderCustomOIDCNonceDisabled(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	nonceDisabled := customProviderOpts{disableNonce: true}

	t.Run("authorize URL carries no nonce", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider, _ := buildCustomTestProviderWithOpts(t, idp, nonceDisabled)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)

		c, _ := getController(
			t, ctrl, customFlowConfigWithOpts(idp, nonceDisabled),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signInAndParseAuthURL(t, c)

		if authURL.Query().Has("nonce") {
			t.Errorf(
				"a nonce-disabled provider must not receive a nonce parameter: %q",
				authURL,
			)
		}
	})

	// The two IdP shapes the flag exists for. Both sign the user up.
	idpShapes := []struct {
		name string
		// nonceClaim is what the IdP puts in the minted id_token's nonce
		// claim; "" omits the claim entirely.
		nonceClaim string
	}{
		{
			// LinkedIn: ignores the nonce parameter and returns no claim.
			// Under strict validation this is ErrNonceMissing.
			name:       "id_token without a nonce claim signs up",
			nonceClaim: "",
		},
		{
			// AWS Cognito: mints its own nonce. Validate(token, "") would
			// compare the claim against HashNonce("") and reject it.
			name:       "id_token with an IdP-minted nonce claim signs up",
			nonceClaim: "cognito-minted-nonce",
		},
	}

	for _, tc := range idpShapes {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newCustomTestIDP(t)
			idp.SetNonceClaim(tc.nonceClaim)

			provider, _ := buildCustomTestProviderWithOpts(t, idp, nonceDisabled)

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			db := mock.NewMockDBClient(ctrl)
			expectCustomProviderSignup(db, idp, userID, refreshTokenID)

			c, _ := getController(
				t, ctrl, customFlowConfigWithOpts(idp, nonceDisabled),
				func(*gomock.Controller) controller.DBClient { return db },
				withExtraProviders(providers.Map{"c:test": provider}),
			)

			authURL := signInAndParseAuthURL(t, c)

			resp, err := c.SignInProviderCallbackGet(
				t.Context(), api.SignInProviderCallbackGetRequestObject{
					Params: api.SignInProviderCallbackGetParams{
						Code:  ptr("test-code"),
						State: authURL.Query().Get("state"),
					},
					Provider: "c:test",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			redirect, ok := resp.(api.SignInProviderCallbackGet302Response)
			if !ok {
				t.Fatalf("expected the sign-up to succeed, got %T: %v", resp, resp)
			}

			matched, err := regexp.MatchString(
				`^http://localhost:3000\?refreshToken=[\w-]+$`,
				redirect.Headers.Location,
			)
			if err != nil || !matched {
				t.Errorf("unexpected callback redirect: %q", redirect.Headers.Location)
			}
		})
	}

	// disableNonce is per-provider, not deployment-wide: a neighbouring strict
	// provider keeps its binding.
	t.Run("a nonce-disabled provider does not relax a strict one", func(t *testing.T) {
		t.Parallel()

		idp := newCustomTestIDP(t)
		provider := buildCustomTestProvider(t, idp)

		ctrl := gomock.NewController(t)
		defer ctrl.Finish()

		db := mock.NewMockDBClient(ctrl)

		// The provider is strict; only the config entry claims otherwise.
		c, _ := getController(
			t, ctrl, customFlowConfigWithOpts(idp, nonceDisabled),
			func(*gomock.Controller) controller.DBClient { return db },
			withExtraProviders(providers.Map{"c:test": provider}),
		)

		authURL := signInAndParseAuthURL(t, c)

		// The config says the nonce is off, yet the URL carries one: the browser
		// flow reads the provider, not the config.
		if !authURL.Query().Has("nonce") {
			t.Fatalf("expected the strict provider to still send a nonce: %q", authURL)
		}

		// The IdP returns no nonce claim, which a strict provider rejects.
		idp.SetNonceClaim("")

		resp, err := c.SignInProviderCallbackGet(
			t.Context(), api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{
					Code:  ptr("test-code"),
					State: authURL.Query().Get("state"),
				},
				Provider: "c:test",
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		redirect, ok := resp.(controller.ErrorRedirectResponse)
		if !ok {
			t.Fatalf("expected the strict provider to reject, got %T: %v", resp, resp)
		}

		// ErrorRedirectResponse is every browser-callback failure's return type,
		// so only the code says the nonce caused it.
		if !strings.Contains(redirect.Headers.Location, "error=oauth-profile-fetch-failed") {
			t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
		}
	})
}

// TestSignInProviderCustomOIDCNonceDisabledIgnoresLeftoverStateNonce is why the
// disabled arm never reads extra["nonce"]. States carry no provider identifier,
// so one minted at a strict provider arrives with a nonce — as every in-flight
// state does for a minute after an operator flips the flag on.
func TestSignInProviderCustomOIDCNonceDisabledIgnoresLeftoverStateNonce(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	nonceDisabled := customProviderOpts{disableNonce: true}

	cases := []struct {
		name string
		// nonceClaim is the claim the IdP puts in the id_token; "" omits it.
		nonceClaim string
	}{
		{name: "idp omits the claim", nonceClaim: ""},
		{name: "idp minted its own", nonceClaim: "cognito-minted-nonce"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			idp := newCustomTestIDP(t)
			idp.SetNonceClaim(tc.nonceClaim)

			lax, _ := buildCustomTestProviderWithOpts(t, idp, nonceDisabled)
			strict := buildCustomTestProvider(t, idp)

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			db := mock.NewMockDBClient(ctrl)
			expectCustomProviderSignup(db, idp, userID, refreshTokenID)

			c, _ := getController(
				t, ctrl, customFlowConfigWithOpts(idp, nonceDisabled),
				func(*gomock.Controller) controller.DBClient { return db },
				withExtraProviders(providers.Map{"c:test": lax, "c:strict": strict}),
			)

			// Minted at the strict provider, so State.Nonce is set.
			authURL := signInAndParseAuthURLFor(t, c, "c:strict")
			if !authURL.Query().Has("nonce") {
				t.Fatalf("expected the strict provider to mint a state nonce: %q", authURL)
			}

			resp, err := c.SignInProviderCallbackGet(
				t.Context(), api.SignInProviderCallbackGetRequestObject{
					Params: api.SignInProviderCallbackGetParams{
						Code:  ptr("test-code"),
						State: authURL.Query().Get("state"),
					},
					Provider: "c:test",
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			redirect, ok := resp.(api.SignInProviderCallbackGet302Response)
			if !ok {
				t.Fatalf("expected the leftover nonce to be ignored, got %T: %v", resp, resp)
			}

			matched, err := regexp.MatchString(
				`^http://localhost:3000\?refreshToken=[\w-]+$`,
				redirect.Headers.Location,
			)
			if err != nil || !matched {
				t.Errorf("unexpected callback redirect: %q", redirect.Headers.Location)
			}
		})
	}
}

// TestSignInProviderCustomRefusesCallerIDTokenWhenExchangeHasNone reaches
// callbackIDToken's second branch, dead in every other fixture. With no id_token
// from the exchange the only source left is the caller's query parameter, and the
// injected token is otherwise perfect — right key, issuer, audience and state
// nonce — so dropping the guard signs up as victim-user.
func TestSignInProviderCustomRefusesCallerIDTokenWhenExchangeHasNone(t *testing.T) {
	t.Parallel()

	idp := newCustomTestIDP(t)
	idp.SetOmitIDToken(true)

	provider := buildCustomTestProvider(t, idp)

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	db := mock.NewMockDBClient(ctrl)

	c, _ := getController(
		t, ctrl, customFlowConfig(idp),
		func(*gomock.Controller) controller.DBClient { return db },
		withExtraProviders(providers.Map{"c:test": provider}),
	)

	authURL := signInAndParseAuthURL(t, c)
	query := authURL.Query()

	nonce := query.Get("nonce")
	idp.SetNonceClaim(nonce)

	victimToken := idp.MintIDToken(t, jwt.MapClaims{
		"iss":            idp.URL(),
		"aud":            "client-id",
		"sub":            "victim-user",
		"email":          "victim@example.com",
		"email_verified": true,
		"name":           "Victim",
		"nonce":          nonce,
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	})

	resp, err := c.SignInProviderCallbackGet(
		t.Context(), api.SignInProviderCallbackGetRequestObject{
			Params: api.SignInProviderCallbackGetParams{
				Code:    ptr("test-code"),
				State:   query.Get("state"),
				IdToken: ptr(victimToken),
			},
			Provider: "c:test",
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	redirect, ok := resp.(controller.ErrorRedirectResponse)
	if !ok {
		t.Fatalf("expected the caller-supplied id_token to be refused, got %T: %v", resp, resp)
	}

	if !strings.Contains(redirect.Headers.Location, "error=oauth-profile-fetch-failed") {
		t.Errorf("unexpected error redirect: %q", redirect.Headers.Location)
	}
}

func TestSignInProviderBuiltInAuthURLHasNoNonce(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	db := mock.NewMockDBClient(ctrl)

	c, _ := getController(
		t, ctrl, getConfig,
		func(*gomock.Controller) controller.DBClient { return db },
	)

	resp, err := c.SignInProvider(t.Context(), api.SignInProviderRequestObject{
		Params:   api.SignInProviderParams{},
		Provider: "fake",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	redirect, ok := resp.(api.SignInProvider302Response)
	if !ok {
		t.Fatalf("expected 302 response, got %T: %v", resp, resp)
	}

	authURL, err := url.Parse(redirect.Headers.Location)
	if err != nil {
		t.Fatalf("failed to parse authorize URL: %v", err)
	}

	if authURL.Query().Has("nonce") {
		t.Errorf("built-in provider must not receive a nonce: %q", authURL)
	}
}
