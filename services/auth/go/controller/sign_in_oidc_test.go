package controller_test

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nhost/nhost/internal/lib/oapi"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
	"golang.org/x/oauth2"
)

const (
	oidcPrimary             = "authentik"
	oidcSecondary           = "second"
	oidcFixtureSubject      = "idp-user"
	oidcFixtureEmail        = "example@nhost.io"
	oidcFixturePrefix       = "/v1"
	oidcFixtureClientSecret = "fixture-secret"
)

type oidcGrant struct {
	issuer    string
	nonce     string
	redirect  string
	challenge string
}

type oidcRouteFixture struct {
	server        *httptest.Server
	key           *ecdsa.PrivateKey
	grants        sync.Map
	emailVerified bool
	omitEmail     bool
}

func newOIDCRouteFixture(t *testing.T, emailVerified bool) *oidcRouteFixture {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	jwk, err := jwkset.NewJWKFromKey(&key.PublicKey, jwkset.JWKOptions{
		Metadata: jwkset.JWKMetadataOptions{
			KID: "test-key", ALG: jwkset.AlgES256, USE: jwkset.UseSig,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	f := &oidcRouteFixture{key: key, emailVerified: emailVerified}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /application/o/{slug}/.well-known/openid-configuration", func(
		w http.ResponseWriter, r *http.Request,
	) {
		issuer := oidcFixtureIssuer(r.Host, r.PathValue("slug"))
		writeOIDCRouteJSON(t, w, map[string]any{
			"issuer":                                issuer,
			"authorization_endpoint":                issuer + "authorize/",
			"token_endpoint":                        issuer + "token/",
			"jwks_uri":                              issuer + "jwks/",
			"id_token_signing_alg_values_supported": []string{"ES256"},
			"authorization_response_iss_parameter_supported": true,
		})
	})
	mux.HandleFunc("GET /application/o/{slug}/jwks/", func(w http.ResponseWriter, _ *http.Request) {
		writeOIDCRouteJSON(t, w, jwkset.JWKSMarshal{Keys: []jwkset.JWKMarshal{jwk.Marshal()}})
	})
	mux.HandleFunc("GET /application/o/{slug}/authorize/", f.authorize)
	mux.HandleFunc(
		"POST /application/o/{slug}/token/",
		func(w http.ResponseWriter, r *http.Request) {
			f.exchange(t, w, r)
		},
	)
	f.server = httptest.NewTLSServer(mux)
	t.Cleanup(f.server.Close)

	return f
}

func writeOIDCRouteJSON(t *testing.T, w http.ResponseWriter, payload any) {
	t.Helper()

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		t.Error(err)
	}
}

func oidcFixtureIssuer(host, slug string) string {
	return "https://" + host + "/application/o/" + slug + "/"
}

func (f *oidcRouteFixture) issuer(slug string) string {
	return f.server.URL + "/application/o/" + slug + "/"
}

func (f *oidcRouteFixture) authorize(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	slug := r.PathValue("slug")

	callback, err := url.Parse(query.Get("redirect_uri"))
	if err != nil || callback.Scheme != "https" ||
		callback.Path != "/v1/signin/oidc/"+slug+"/callback" ||
		query.Get("client_id") != "web-"+slug ||
		query.Get("response_type") != "code" ||
		query.Get("code_challenge_method") != "S256" ||
		query.Get("nonce") == "" ||
		pkce.ValidateCodeChallengeFormat(query.Get("code_challenge")) != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	code := oauth2.GenerateVerifier()
	issuer := oidcFixtureIssuer(r.Host, slug)
	f.grants.Store(code, oidcGrant{
		issuer: issuer, nonce: query.Get("nonce"), redirect: callback.String(),
		challenge: query.Get("code_challenge"),
	})
	callback.RawQuery = url.Values{
		"code": {code}, "state": {query.Get("state")}, "iss": {issuer},
	}.Encode()
	http.Redirect(w, r, callback.String(), http.StatusFound)
}

func (f *oidcRouteFixture) exchange(t *testing.T, w http.ResponseWriter, r *http.Request) {
	t.Helper()

	slug := r.PathValue("slug")
	issuer := oidcFixtureIssuer(r.Host, slug)

	clientID, secret, _ := r.BasicAuth()
	if err := r.ParseForm(); err != nil || clientID != "web-"+slug ||
		secret != oidcFixtureClientSecret {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	value, ok := f.grants.LoadAndDelete(r.Form.Get("code"))

	grant, valid := value.(oidcGrant)
	if !ok || !valid || grant.issuer != issuer || r.Form.Get("redirect_uri") != grant.redirect ||
		pkce.ValidateS256(grant.challenge, r.Form.Get("code_verifier")) != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	token, err := f.idToken(issuer, clientID, grant.nonce)
	if err != nil {
		t.Error(err)
		w.WriteHeader(http.StatusInternalServerError)

		return
	}

	writeOIDCRouteJSON(t, w, map[string]string{
		"access_token": "fixture-upstream-access", "token_type": "Bearer", "id_token": token,
	})
}

func (f *oidcRouteFixture) idToken(issuer, audience, nonce string) (string, error) {
	now := time.Now()

	claims := jwt.MapClaims{
		"iss": issuer, "sub": oidcFixtureSubject, "aud": audience,
		"iat": now.Unix(), "exp": now.Add(time.Minute).Unix(),
		"email": oidcFixtureEmail, "email_verified": f.emailVerified, "nonce": nonce,
		"name": "Fixture User",
	}
	if f.omitEmail {
		delete(claims, "email")
		delete(claims, "email_verified")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = "test-key"

	return token.SignedString(f.key) //nolint:wrapcheck
}

func (f *oidcRouteFixture) router(
	t *testing.T, registry *providers.OIDCRegistry, db *mock.MockDBClient,
	opts ...getControllerOptsFunc,
) (http.Handler, *controller.JWTGetter) {
	t.Helper()

	return f.routerWithLogger(t, registry, db, slog.New(slog.DiscardHandler), opts...)
}

func (f *oidcRouteFixture) routerWithLogger(
	t *testing.T, registry *providers.OIDCRegistry, db *mock.MockDBClient,
	logger *slog.Logger, opts ...getControllerOptsFunc,
) (http.Handler, *controller.JWTGetter) {
	t.Helper()

	opts = append(opts, func(opts *getControllerOpts) {
		opts.oidcProviders = registry
	})

	c, signer := getController(t, gomock.NewController(t), func() *controller.Config {
		config := getConfig()
		config.DisableAutoSignup = true
		config.RequireEmailVerification = true
		config.AccessTokenExpiresIn = int((2 * time.Minute).Seconds())
		config.ServerURL = config.ServerURL.JoinPath("v1")

		return config
	}, func(_ *gomock.Controller) controller.DBClient {
		return db
	}, opts...)

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}

	router, validator, err := oapi.NewRouter(
		spec, oidcFixturePrefix, signer.MiddlewareFunc,
		oapimw.CORSOptions{AllowedOrigins: []string{"http://localhost:3000"}},
		logger,
	)
	if err != nil {
		t.Fatal(err)
	}

	router.Use(middleware.OIDCRequests(oidcFixturePrefix))
	api.RegisterHandlersWithOptions(router, api.NewStrictHandler(c, nil), api.GinServerOptions{
		BaseURL:      oidcFixturePrefix,
		Middlewares:  []api.MiddlewareFunc{validator},
		ErrorHandler: oapi.RecordError,
	})

	return router, signer
}

func (f *oidcRouteFixture) registry(t *testing.T, disableSecondNonce bool) *providers.OIDCRegistry {
	t.Helper()

	serverURL := getConfig().ServerURL.JoinPath("v1")
	raw := `{
		"authentik":{"issuer":"` + f.issuer(oidcPrimary) + `","clientId":"web-authentik","clientSecret":"fixture-secret","audiences":["native-authentik"]},
		"second":{"issuer":"` + f.issuer(oidcSecondary) + `","clientId":"web-second","clientSecret":"fixture-secret","audiences":["native-second"],
			"disableNonce":` + strconv.FormatBool(disableSecondNonce) + `}
	}`

	registry, err := providers.NewOIDCRegistry(
		raw,
		serverURL,
		f.server.Client(),
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatal(err)
	}

	return registry
}

func oidcRouteRequest(
	t *testing.T, handler http.Handler, method, target string, body any, cookies ...*http.Cookie,
) *httptest.ResponseRecorder {
	t.Helper()

	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(method, target, bytes.NewReader(data))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)

	return resp
}

func TestOIDCBrowserStartLogsDiscoveryError(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)

	raw, err := json.Marshal(map[string]map[string]string{
		oidcPrimary: {
			"issuer":       fixture.issuer(oidcPrimary),
			"discoveryUrl": fixture.issuer(oidcSecondary) + ".well-known/openid-configuration",
			"clientId":     "web-authentik",
			"clientSecret": oidcFixtureClientSecret,
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	registry, err := providers.NewOIDCRegistry(
		string(
			raw,
		),
		getConfig().ServerURL.JoinPath("v1"),
		fixture.server.Client(),
		slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatal(err)
	}

	var logs bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	db := mock.NewMockDBClient(gomock.NewController(t))
	handler, _ := fixture.routerWithLogger(t, registry, db, logger)
	challenge := pkce.ComputeS256Challenge(oauth2.GenerateVerifier())

	resp := oidcRouteRequest(t, handler, http.MethodGet,
		"/v1/signin/oidc/authentik?codeChallenge="+challenge, nil,
	)
	if resp.Code != http.StatusBadRequest ||
		!strings.Contains(resp.Body.String(), "oauth-provider-error") {
		t.Fatalf("expected provider error, got HTTP %d", resp.Code)
	}

	if strings.Contains(logs.String(), oidcFixtureClientSecret) {
		t.Fatal("OIDC start logs contain the client secret")
	}

	decoder := json.NewDecoder(&logs)
	for decoder.More() {
		var record struct {
			Message string `json:"msg"`
			Level   string `json:"level"`
			Error   string `json:"error"`
		}
		if err := decoder.Decode(&record); err != nil {
			t.Fatal(err)
		}

		if record.Message == "failed to start OIDC authorization" {
			if record.Level != "WARN" || !strings.Contains(record.Error, "issuer mismatch") {
				t.Fatal("OIDC start warning does not contain the discovery error")
			}

			return
		}
	}

	t.Fatal("missing OIDC start warning")
}

func expectOIDCSession(db *mock.MockDBClient, userID uuid.UUID) {
	db.EXPECT().GetUserRoles(gomock.Any(), userID).Return(nil, nil)
	db.EXPECT().InsertRefreshtoken(gomock.Any(), gomock.Any()).Return(uuid.New(), nil)
	db.EXPECT().UpdateUserLastSeen(gomock.Any(), userID).Return(sql.TimestampTz(time.Now()), nil)
}

func assertOIDCSession(t *testing.T, resp *httptest.ResponseRecorder, userID uuid.UUID) {
	t.Helper()

	if resp.Code != http.StatusOK {
		t.Fatalf("expected session, got %d: %s", resp.Code, resp.Body.String())
	}

	var payload api.SessionPayload
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}

	if payload.Session == nil || payload.Session.AccessToken == "" ||
		payload.Session.RefreshToken == "" ||
		payload.Session.User == nil ||
		payload.Session.User.Id != userID.String() {
		t.Fatal("expected an Auth session for the issuer-bound user")
	}
}

func TestOIDCBrowserRoutes(t *testing.T) {
	t.Parallel()

	for _, flow := range []string{"signin", "signup"} {
		t.Run(flow, func(t *testing.T) {
			t.Parallel()

			fixture := newOIDCRouteFixture(t, true)
			registry := fixture.registry(t, false)
			db := mock.NewMockDBClient(gomock.NewController(t))
			handler, _ := fixture.router(t, registry, db)

			slug := oidcPrimary
			if flow == "signup" {
				slug = oidcSecondary
			}

			user := expectOIDCBrowserIdentity(db, registry.Get(slug), flow == "signup")

			appVerifier := oauth2.GenerateVerifier()
			appChallenge := pkce.ComputeS256Challenge(appVerifier)

			var stored sql.InsertPKCEAuthorizationCodeParams
			db.EXPECT().InsertPKCEAuthorizationCode(gomock.Any(), gomock.Any()).DoAndReturn(
				func(_ context.Context, params sql.InsertPKCEAuthorizationCodeParams) (sql.AuthPkceAuthorizationCode, error) {
					stored = params
					return sql.AuthPkceAuthorizationCode{}, nil
				},
			)

			start := oidcRouteRequest(
				t,
				handler,
				http.MethodGet,
				"/v1/"+flow+"/oidc/"+slug+"?codeChallenge="+appChallenge+"&state=application-state",
				nil,
			)
			callback, cookie := startOIDCBrowser(t, fixture, start)

			assertOIDCCallbackBindings(t, handler, slug, callback, cookie)

			response := oidcRouteRequest(
				t,
				handler,
				http.MethodGet,
				callback+"&id_token=ignored",
				nil,
				cookie,
			)
			if response.Code != http.StatusFound ||
				response.Header().Get("Referrer-Policy") != "no-referrer" ||
				!strings.Contains(response.Header().Get("Set-Cookie"), "Max-Age=0") {
				t.Fatalf(
					"unexpected callback response %d: %s",
					response.Code,
					response.Body.String(),
				)
			}

			redirect, err := url.Parse(response.Header().Get("Location"))
			if err != nil {
				t.Fatal(err)
			}

			code := assertOIDCBrowserRedirect(t, redirect, stored, appChallenge, user.ID)

			exchange := func(verifier string) *httptest.ResponseRecorder {
				return oidcRouteRequest(t, handler, http.MethodPost, "/v1/token/exchange",
					api.TokenExchangeRequest{Code: code, CodeVerifier: verifier})
			}
			badVerifier := oauth2.GenerateVerifier()
			db.EXPECT().
				ConsumePKCEAuthorizationCode(gomock.Any(), sql.ConsumePKCEAuthorizationCodeParams{
					CodeHash:      stored.CodeHash,
					CodeChallenge: pkce.ComputeS256Challenge(badVerifier),
				}).
				Return(sql.AuthPkceAuthorizationCode{}, pgx.ErrNoRows)

			if response := exchange(badVerifier); response.Code != http.StatusBadRequest {
				t.Fatal("Auth code accepted the wrong verifier")
			}

			db.EXPECT().
				ConsumePKCEAuthorizationCode(gomock.Any(), sql.ConsumePKCEAuthorizationCodeParams{
					CodeHash: stored.CodeHash, CodeChallenge: appChallenge,
				}).
				Return(sql.AuthPkceAuthorizationCode{UserID: user.ID}, nil)
			db.EXPECT().GetUser(gomock.Any(), user.ID).Return(*user, nil)
			expectOIDCSession(db, user.ID)
			assertOIDCSession(t, exchange(appVerifier), user.ID)
		})
	}
}

func assertOIDCBrowserRedirect(
	t *testing.T, redirect *url.URL, stored sql.InsertPKCEAuthorizationCodeParams,
	challenge string, userID uuid.UUID,
) string {
	t.Helper()

	query := redirect.Query()
	if redirect.Host != getConfig().ClientURL.Host || query.Get("state") != "application-state" {
		t.Fatalf("invalid Auth code redirect: %s", redirect)
	}

	code := query.Get("code")
	if code == "" || query.Has("refreshToken") {
		t.Fatal("expected an Auth authorization code in the redirect")
	}

	if stored.CodeHash != pkce.HashCode(code) {
		t.Fatal("stored Auth code hash does not match the redirect")
	}

	if stored.CodeChallenge != challenge || stored.UserID != userID {
		t.Fatal("Auth code was stored for the wrong user or PKCE challenge")
	}

	return code
}

func expectOIDCBrowserIdentity(
	db *mock.MockDBClient, provider *oidc.CustomProvider, signup bool,
) *sql.AuthUser {
	subject := provider.IdentityKey(oidcFixtureSubject)
	userID := uuid.New()
	user := getSigninUser(userID)

	identity := db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), sql.GetUserByOIDCIdentityParams{
		ProviderID: provider.ID(), Issuer: sql.Text(provider.Issuer()), Subject: subject,
	})
	if signup {
		identity.Return(sql.AuthUser{}, pgx.ErrNoRows)
		db.EXPECT().InsertUserWithUserProvider(gomock.Any(), gomock.Cond(
			func(params sql.InsertUserWithUserProviderParams) bool {
				return params.ProviderID == provider.ID() && params.ProviderUserID == subject &&
					params.Issuer == sql.Text(provider.Issuer()) &&
					params.Email == sql.Text(oidcFixtureEmail) && params.EmailVerified
			},
		)).DoAndReturn(func(_ context.Context, params sql.InsertUserWithUserProviderParams) (uuid.UUID, error) {
			user.ID = params.ID
			return params.ID, nil
		})
	} else {
		identity.Return(user, nil)
	}

	return &user
}

func TestOIDCCallbackIssuerValidation(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	registry := fixture.registry(t, false)

	for _, tt := range []struct {
		name       string
		issuer     string
		wantStatus int
		wantError  string
	}{
		{
			name: "oversize issuer", issuer: strings.Repeat("a", 2049),
			wantStatus: http.StatusBadRequest, wantError: "schema-validation-error",
		},
		{
			name: "mismatched issuer", issuer: fixture.issuer(oidcSecondary),
			wantStatus: http.StatusFound, wantError: "error=" + string(api.OauthTokenEchangeFailed),
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			db := mock.NewMockDBClient(gomock.NewController(t))
			handler, _ := fixture.router(t, registry, db)
			challenge := pkce.ComputeS256Challenge(oauth2.GenerateVerifier())
			start := oidcRouteRequest(t, handler, http.MethodGet,
				"/v1/signin/oidc/authentik?codeChallenge="+challenge, nil)
			callback, cookie := startOIDCBrowser(t, fixture, start)

			target, err := url.Parse(callback)
			if err != nil {
				t.Fatal(err)
			}

			query := target.Query()
			query.Set("iss", tt.issuer)
			target.RawQuery = query.Encode()

			response := oidcRouteRequest(t, handler, http.MethodGet, target.String(), nil, cookie)
			if response.Code != tt.wantStatus {
				t.Fatalf(
					"expected HTTP %d, got HTTP %d: %s",
					tt.wantStatus,
					response.Code,
					response.Body,
				)
			}

			if tt.wantStatus == http.StatusFound {
				if !strings.Contains(response.Header().Get("Location"), tt.wantError) {
					t.Fatalf(
						"expected issuer mismatch error redirect, got %s",
						response.Header().Get("Location"),
					)
				}
			} else if !strings.Contains(response.Body.String(), tt.wantError) ||
				response.Header().Get("Location") != "" {
				t.Fatalf("expected schema rejection before the callback handler: %s", response.Body)
			}
		})
	}
}

func assertOIDCCallbackBindings(
	t *testing.T, handler http.Handler, slug, callback string, cookie *http.Cookie,
) {
	t.Helper()

	wrongProvider := strings.Replace(callback, "/oidc/"+slug, "/oidc/unknown", 1)
	if resp := oidcRouteRequest(
		t,
		handler,
		http.MethodGet,
		wrongProvider,
		nil,
		cookie,
	); resp.Code != http.StatusFound || !strings.Contains(resp.Header().Get("Location"), "error=disabled-endpoint") {
		t.Fatal("expected the disabled-endpoint redirect for an unknown provider")
	}

	other := oidcPrimary
	if slug == oidcPrimary {
		other = oidcSecondary
	}

	otherCallback := strings.Replace(callback, "/oidc/"+slug, "/oidc/"+other, 1)
	for _, attempt := range []struct {
		target  string
		cookies []*http.Cookie
	}{
		{target: callback, cookies: nil},
		{target: otherCallback, cookies: []*http.Cookie{cookie}},
		{target: callback + "&state=duplicate", cookies: []*http.Cookie{cookie}},
	} {
		resp := oidcRouteRequest(
			t,
			handler,
			http.MethodGet,
			attempt.target,
			nil,
			attempt.cookies...)
		if resp.Code != http.StatusBadRequest {
			t.Fatalf("invalid callback returned %d: %s", resp.Code, resp.Body.String())
		}
	}
}

func startOIDCBrowser(
	t *testing.T, f *oidcRouteFixture, start *httptest.ResponseRecorder,
) (string, *http.Cookie) {
	t.Helper()

	if start.Code != http.StatusFound || start.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("unexpected OIDC start %d: %s", start.Code, start.Body.String())
	}

	r := start.Result()
	t.Cleanup(func() { _ = r.Body.Close() })

	cookies := r.Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].Path != "/" ||
		cookies[0].SameSite != http.SameSiteLaxMode || !strings.HasPrefix(cookies[0].Name, "__Host-") {
		t.Fatal("missing host-bound browser cookie")
	}

	client := *f.server.Client()
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }

	req, err := http.NewRequestWithContext(
		t.Context(),
		http.MethodGet,
		start.Header().Get("Location"),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	auth, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer auth.Body.Close()

	if auth.StatusCode != http.StatusFound {
		t.Fatalf("fixture provider returned %d", auth.StatusCode)
	}

	return auth.Header.Get("Location"), cookies[0]
}

func TestOIDCBrowserConnect(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	registry := fixture.registry(t, false)
	db := mock.NewMockDBClient(gomock.NewController(t))
	handler, signer := fixture.router(t, registry, db, withElevationMode("disabled"))

	connectURL := "/v1/signin/oidc/authentik?connect="

	userID := uuid.New()

	accessToken, _, err := signer.GetToken(
		t.Context(), userID, false, []string{"user"}, "user", nil, slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatal(err)
	}

	authToken, err := signer.Validate(accessToken)
	if err != nil {
		t.Fatal(err)
	}

	expiry, err := authToken.Claims.GetExpirationTime()
	if err != nil || expiry == nil {
		t.Fatalf("Auth session expiry missing: %v", err)
	}

	start := oidcRouteRequest(
		t,
		handler,
		http.MethodGet,
		connectURL+url.QueryEscape(accessToken),
		nil,
	)

	authorizeURL, err := url.Parse(start.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}

	if authorizeURL.Query().Has("connect") {
		t.Fatal("connect was forwarded to the identity provider")
	}

	state, err := signer.Validate(authorizeURL.Query().Get("state"))
	if err != nil {
		t.Fatal(err)
	}

	claims, err := json.Marshal(state.Claims)
	if err != nil || strings.Contains(string(claims), accessToken) {
		t.Fatal("the authorize state must not expose the Auth access token")
	}

	stateExpiry, err := state.Claims.GetExpirationTime()
	if err != nil || stateExpiry == nil || !stateExpiry.Equal(expiry.Time) {
		t.Fatal("the link state must expire with the connect token")
	}

	callback, cookie := startOIDCBrowser(t, fixture, start)
	provider := registry.Get(oidcPrimary)

	db.EXPECT().GetUser(gomock.Any(), userID).Return(getSigninUser(userID), nil)
	db.EXPECT().InsertUserProvider(gomock.Any(), sql.InsertUserProviderParams{
		UserID: userID, ProviderID: provider.ID(), Issuer: sql.Text(provider.Issuer()),
		ProviderUserID: provider.IdentityKey(oidcFixtureSubject),
	}).Return(sql.AuthUserProvider{}, nil)

	result := oidcRouteRequest(t, handler, http.MethodGet, callback, nil, cookie)
	if result.Code != http.StatusFound ||
		result.Header().Get("Location") != getConfig().ClientURL.String() {
		t.Fatalf(
			"expected link redirect without a session, got %d %s",
			result.Code,
			result.Body.String(),
		)
	}
}

func TestOIDCBrowserConnectRejectsNonSessionTokens(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	db := mock.NewMockDBClient(gomock.NewController(t))
	handler, signer := fixture.router(t, fixture.registry(t, false), db)

	connectURL := "/v1/signin/oidc/authentik?connect="

	bad := oidcRouteRequest(t, handler, http.MethodGet, connectURL+"invalid", nil)
	if bad.Code != http.StatusBadRequest {
		t.Fatal("an invalid connect token started the authorization flow")
	}

	userID := uuid.New()

	namespace, sessionClaims, err := signer.GraphQLClaims(
		t.Context(), userID, false, []string{"user"}, "user", nil, slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name   string
		claims jwt.MapClaims
	}{
		{
			name:   "OAuth2 ID token",
			claims: jwt.MapClaims{"sub": userID.String(), "aud": "oauth-client"},
		},
		{
			name: "OAuth2 access token with GraphQL claims",
			claims: jwt.MapClaims{
				"sub": userID.String(), "aud": "oauth-client", "scope": "graphql",
				namespace: sessionClaims,
			},
		},
		{
			name:   "missing session claims",
			claims: jwt.MapClaims{"sub": userID.String()},
		},
		{
			name:   "session subject mismatch",
			claims: jwt.MapClaims{"sub": uuid.NewString(), namespace: sessionClaims},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			token, err := signer.SignTokenWithClaims(tt.claims, time.Now().Add(time.Minute))
			if err != nil {
				t.Fatal(err)
			}

			res := oidcRouteRequest(
				t, handler, http.MethodGet,
				connectURL+url.QueryEscape(token), nil,
			)
			if res.Code != http.StatusBadRequest || res.Header().Get("Location") != "" ||
				res.Header().Get("Set-Cookie") != "" {
				t.Fatalf("expected rejection before starting a browser flow, got HTTP %d", res.Code)
			}
		})
	}
}

func TestOIDCBrowserConnectElevation(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	registry := fixture.registry(t, false)
	userID := uuid.New()

	for _, tt := range []struct {
		name       string
		mode       string
		elevated   string
		hasMethod  bool
		lookupErr  error
		wantStatus int
	}{
		{name: "required rejects plain session", mode: "required", elevated: "", hasMethod: false, lookupErr: nil, wantStatus: http.StatusBadRequest},
		{name: "required accepts elevated session", mode: "required", elevated: userID.String(), hasMethod: false, lookupErr: nil, wantStatus: http.StatusFound},
		{name: "required rejects mismatched elevation", mode: "required", elevated: uuid.NewString(), hasMethod: false, lookupErr: nil, wantStatus: http.StatusBadRequest},
		{name: "disabled accepts plain session", mode: "disabled", elevated: "", hasMethod: false, lookupErr: nil, wantStatus: http.StatusFound},
		{name: "recommended rejects plain session with method", mode: "recommended", elevated: "", hasMethod: true, lookupErr: nil, wantStatus: http.StatusBadRequest},
		{name: "recommended accepts plain session without method", mode: "recommended", elevated: "", hasMethod: false, lookupErr: nil, wantStatus: http.StatusFound},
		{name: "recommended accepts elevated session", mode: "recommended", elevated: userID.String(), hasMethod: true, lookupErr: nil, wantStatus: http.StatusFound},
		{name: "recommended fails closed on method lookup error", mode: "recommended", elevated: "", hasMethod: false, lookupErr: pgx.ErrNoRows, wantStatus: http.StatusBadRequest},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			db := mock.NewMockDBClient(gomock.NewController(t))
			if tt.mode == "recommended" && tt.elevated == "" {
				db.EXPECT().GetElevationMethods(gomock.Any(), userID).Return(
					sql.GetElevationMethodsRow{HasSecurityKey: tt.hasMethod}, tt.lookupErr,
				)
			}

			handler, signer := fixture.router(t, registry, db, withElevationMode(tt.mode))

			namespace, claims, err := signer.GraphQLClaims(
				t.Context(),
				userID,
				false,
				[]string{"user"},
				"user",
				nil,
				slog.New(slog.DiscardHandler),
			)
			if err != nil {
				t.Fatal(err)
			}

			if tt.elevated != "" {
				claims["x-hasura-auth-elevated"] = tt.elevated
			}

			token, err := signer.SignTokenWithClaims(jwt.MapClaims{
				"sub": userID.String(), namespace: claims,
			}, time.Now().Add(time.Minute))
			if err != nil {
				t.Fatal(err)
			}

			res := oidcRouteRequest(t, handler, http.MethodGet,
				"/v1/signin/oidc/authentik?connect="+url.QueryEscape(token), nil)
			if res.Code != tt.wantStatus {
				t.Fatalf("expected HTTP %d, got %d", tt.wantStatus, res.Code)
			}

			if tt.wantStatus == http.StatusFound {
				if res.Header().Get("Location") == "" || res.Header().Get("Set-Cookie") == "" {
					t.Fatal("authorized link did not start a browser flow")
				}
			} else if res.Header().Get("Location") != "" || res.Header().Get("Set-Cookie") != "" {
				t.Fatal("rejected link started a browser flow")
			}
		})
	}
}

func TestOIDCBrowserUnknownAndMalformedSlug(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	db := mock.NewMockDBClient(gomock.NewController(t))

	handler, _ := fixture.router(t, fixture.registry(t, false), db)
	query := "?codeChallenge=" + pkce.ComputeS256Challenge(oauth2.GenerateVerifier())

	for _, flow := range []string{"signin", "signup"} {
		prefix := "/v1/" + flow + "/oidc/"

		unknown := oidcRouteRequest(t, handler, http.MethodGet, prefix+"unknown"+query, nil)
		if unknown.Code != http.StatusFound || !strings.Contains(
			unknown.Header().Get("Location"), "error=disabled-endpoint",
		) {
			t.Fatalf("expected disabled-endpoint redirect for unknown provider on %s", flow)
		}

		malformed := oidcRouteRequest(t, handler, http.MethodGet, prefix+"a-"+query, nil)
		if malformed.Code != http.StatusBadRequest ||
			!strings.HasPrefix(malformed.Header().Get("Content-Type"), "application/json") {
			t.Fatalf("expected a JSON 400 for a malformed slug on %s", flow)
		}
	}
}

func TestOIDCBrowserDisplayNameValidation(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	db := mock.NewMockDBClient(gomock.NewController(t))
	handler, _ := fixture.router(t, fixture.registry(t, false), db)
	challenge := pkce.ComputeS256Challenge(oauth2.GenerateVerifier())

	for _, flow := range []string{"signin", "signup"} {
		for _, tt := range []struct {
			name        string
			displayName string
			wantStatus  int
		}{
			{name: "HTML with forbidden punctuation", displayName: "<img src=x/>", wantStatus: http.StatusBadRequest},
			{name: "forbidden punctuation", displayName: "a:b/c&d", wantStatus: http.StatusBadRequest},
			{name: "too long", displayName: strings.Repeat("a", 33), wantStatus: http.StatusBadRequest},
			{name: "Unicode and allowed punctuation", displayName: "Élodie \u674e 2 ☀,.'-", wantStatus: http.StatusFound},
			{name: "maximum length", displayName: strings.Repeat("a", 32), wantStatus: http.StatusFound},
		} {
			t.Run(flow+"/"+tt.name, func(t *testing.T) {
				t.Parallel()

				query := url.Values{"codeChallenge": {challenge}, "displayName": {tt.displayName}}

				res := oidcRouteRequest(
					t, handler, http.MethodGet,
					"/v1/"+flow+"/oidc/authentik?"+query.Encode(), nil,
				)
				if res.Code != tt.wantStatus {
					t.Fatalf("expected HTTP %d, got HTTP %d: %s", tt.wantStatus, res.Code, res.Body)
				}

				if tt.wantStatus == http.StatusBadRequest &&
					(!strings.Contains(res.Body.String(), "schema-validation-error") ||
						res.Header().Get("Location") != "" || res.Header().Get("Set-Cookie") != "") {
					t.Fatalf("expected rejection before starting a browser flow: %s", res.Body)
				}
			})
		}
	}
}

func TestOIDCBrowserSignupRequiresPKCE(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	db := mock.NewMockDBClient(gomock.NewController(t))

	handler, _ := fixture.router(t, fixture.registry(t, false), db)
	for _, tt := range []struct {
		name      string
		query     string
		errorText string
	}{
		{name: "missing challenge", query: "", errorText: "codeChallenge"},
		{name: "malformed challenge", query: "?codeChallenge=invalid", errorText: "schema-validation-error"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			res := oidcRouteRequest(
				t,
				handler,
				http.MethodGet,
				"/v1/signup/oidc/authentik"+tt.query,
				nil,
			)
			if res.Code != http.StatusBadRequest ||
				!strings.Contains(res.Body.String(), tt.errorText) ||
				res.Header().Get("Location") != "" ||
				res.Header().Get("Set-Cookie") != "" {
				t.Fatalf("expected a PKCE validation error, got HTTP %d: %s", res.Code, res.Body)
			}
		})
	}
}

func TestOIDCNativeRoutes(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, true)
	registry := fixture.registry(t, true)
	db := mock.NewMockDBClient(gomock.NewController(t))
	handler, _ := fixture.router(t, registry, db)
	nonce := oauth2.GenerateVerifier()
	hash := sha256.Sum256([]byte(nonce))
	token := func(slug string) string {
		t.Helper()

		signed, err := fixture.idToken(
			fixture.issuer(slug),
			"native-"+slug,
			hex.EncodeToString(hash[:]),
		)
		if err != nil {
			t.Fatal(err)
		}

		return signed
	}

	body := api.SignInOidcIdTokenRequest{IdToken: token(oidcPrimary), Nonce: &nonce, Options: nil}

	post := func(path string, request api.SignInOidcIdTokenRequest) *httptest.ResponseRecorder {
		return oidcRouteRequest(t, handler, http.MethodPost, path, request)
	}
	if response := post(
		"/v1/signin/oidc/second/idtoken",
		body,
	); response.Code != http.StatusBadRequest {
		t.Fatalf("token accepted by a different issuer: %d", response.Code)
	}

	wrongNonce := body

	wrongNonce.Nonce = new(oauth2.GenerateVerifier())
	if response := post(
		"/v1/signin/oidc/authentik/idtoken",
		wrongNonce,
	); response.Code != http.StatusBadRequest {
		t.Fatalf("incorrect nonce accepted: %d", response.Code)
	}

	missingNonce := body

	missingNonce.Nonce = nil
	if response := post(
		"/v1/signin/oidc/authentik/idtoken",
		missingNonce,
	); response.Code != http.StatusBadRequest {
		t.Fatalf("required nonce was omitted: %d", response.Code)
	}

	userID := uuid.New()
	db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), sql.GetUserByOIDCIdentityParams{
		ProviderID: "oidc:authentik", Issuer: sql.Text(fixture.issuer(oidcPrimary)),
		Subject: registry.Get(oidcPrimary).IdentityKey(oidcFixtureSubject),
	}).Return(getSigninUser(userID), nil)
	expectOIDCSession(db, userID)
	assertOIDCSession(t, post("/v1/signin/oidc/authentik/idtoken", body), userID)

	subject := registry.Get(oidcSecondary).IdentityKey(oidcFixtureSubject)
	identity := sql.GetUserByOIDCIdentityParams{
		ProviderID: "oidc:second",
		Issuer:     sql.Text(fixture.issuer(oidcSecondary)),
		Subject:    subject,
	}
	body.IdToken = token(oidcSecondary)
	body.Nonce = nil

	db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), identity).Return(sql.AuthUser{}, pgx.ErrNoRows)

	matchSignup := gomock.Cond(
		func(params sql.InsertUserWithUserProviderAndRefreshTokenParams) bool {
			return params.ProviderID == "oidc:second" && params.ProviderUserID == subject &&
				params.Issuer == identity.Issuer &&
				params.Email == sql.Text(oidcFixtureEmail) && params.EmailVerified
		},
	)
	db.EXPECT().InsertUserWithUserProviderAndRefreshToken(gomock.Any(), matchSignup).Return(
		sql.InsertUserWithUserProviderAndRefreshTokenRow{}, &pgconn.PgError{
			Code: "23505", ConstraintName: "users_email_key",
			Message: `duplicate key value violates unique constraint "users_email_key"`,
		},
	)

	conflict := post("/v1/signup/oidc/second/idtoken", body)
	if conflict.Code != http.StatusConflict ||
		!strings.Contains(conflict.Body.String(), "user-already-exists") {
		t.Fatalf(
			"verified conflicting email should not link: %d: %s",
			conflict.Code,
			conflict.Body.String(),
		)
	}

	db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), identity).Return(sql.AuthUser{}, pgx.ErrNoRows)
	db.EXPECT().InsertUserWithUserProviderAndRefreshToken(gomock.Any(), matchSignup).Return(
		sql.InsertUserWithUserProviderAndRefreshTokenRow{
			ID:             userID,
			RefreshTokenID: uuid.New(),
		}, nil,
	)
	assertOIDCSession(t, post("/v1/signup/oidc/second/idtoken", body), userID)
}

func TestOIDCBrowserSignupRequiresEmailVerification(t *testing.T) {
	t.Parallel()

	fixture := newOIDCRouteFixture(t, false)
	registry := fixture.registry(t, false)
	db := mock.NewMockDBClient(gomock.NewController(t))
	emailer := mock.NewMockEmailer(gomock.NewController(t))
	handler, _ := fixture.router(
		t,
		registry,
		db,
		withEmailer(func(_ *gomock.Controller) *mock.MockEmailer {
			return emailer
		}),
	)

	p := registry.Get(oidcPrimary)
	db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), sql.GetUserByOIDCIdentityParams{
		ProviderID: p.ID(),
		Issuer:     sql.Text(p.Issuer()),
		Subject:    p.IdentityKey(oidcFixtureSubject),
	}).Return(sql.AuthUser{}, pgx.ErrNoRows)
	db.EXPECT().InsertUserWithUserProvider(gomock.Any(), gomock.Cond(
		func(params sql.InsertUserWithUserProviderParams) bool {
			return params.Email == sql.Text(oidcFixtureEmail) && !params.EmailVerified &&
				params.Ticket.Valid && params.Issuer == sql.Text(fixture.issuer(oidcPrimary))
		},
	)).Return(uuid.New(), nil)

	challenge := pkce.ComputeS256Challenge(oauth2.GenerateVerifier())
	emailer.EXPECT().SendEmail(
		gomock.Any(), oidcFixtureEmail, "en", notifications.TemplateNameEmailVerify,
		gomock.Cond(func(data notifications.TemplateData) bool {
			link, err := url.Parse(data.Link)

			return err == nil && link.Path == "/v1/verify" &&
				link.Query().Get("codeChallenge") == challenge
		}),
	).Return(nil)

	start := oidcRouteRequest(t, handler, http.MethodGet,
		"/v1/signup/oidc/authentik?codeChallenge="+challenge, nil,
	)
	callback, cookie := startOIDCBrowser(t, fixture, start)

	response := oidcRouteRequest(t, handler, http.MethodGet, callback, nil, cookie)
	if response.Code != http.StatusFound ||
		response.Header().Get("Location") != getConfig().ClientURL.String() {
		t.Fatalf(
			"expected an email verification redirect without a session, got %d: %s",
			response.Code,
			response.Body,
		)
	}
}

// Strict DB expectations ensure no user, authorization code, or refresh token is
// created when an unbound identity is missing its required email claim.
func TestOIDCNewIdentityRequiresEmail(t *testing.T) {
	t.Parallel()

	for _, flow := range []string{"signin", "signup"} {
		for _, transport := range []string{"native", "browser"} {
			t.Run(flow+"/"+transport, func(t *testing.T) {
				t.Parallel()

				fixture := newOIDCRouteFixture(t, true)
				fixture.omitEmail = true
				registry := fixture.registry(t, transport == "native")
				db := mock.NewMockDBClient(gomock.NewController(t))
				handler, _ := fixture.router(t, registry, db)
				provider := registry.Get(oidcSecondary)
				db.EXPECT().GetUserByOIDCIdentity(gomock.Any(), sql.GetUserByOIDCIdentityParams{
					ProviderID: provider.ID(), Issuer: sql.Text(provider.Issuer()),
					Subject: provider.IdentityKey(oidcFixtureSubject),
				}).Return(sql.AuthUser{}, pgx.ErrNoRows)

				if transport == "native" {
					signed, err := fixture.idToken(provider.Issuer(), "native-"+oidcSecondary, "")
					if err != nil {
						t.Fatal(err)
					}

					response := oidcRouteRequest(t, handler, http.MethodPost,
						"/v1/"+flow+"/oidc/"+oidcSecondary+"/idtoken",
						api.SignInOidcIdTokenRequest{IdToken: signed, Nonce: nil, Options: nil})

					assertOIDCEmailRequiredResponse(t, response)

					return
				}

				challenge := pkce.ComputeS256Challenge(oauth2.GenerateVerifier())
				start := oidcRouteRequest(t, handler, http.MethodGet,
					"/v1/"+flow+"/oidc/"+oidcSecondary+"?codeChallenge="+challenge, nil)
				callback, cookie := startOIDCBrowser(t, fixture, start)
				response := oidcRouteRequest(t, handler, http.MethodGet, callback, nil, cookie)

				assertOIDCEmailRequiredRedirect(t, response)
			})
		}
	}
}

func assertOIDCEmailRequiredResponse(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()

	var payload api.ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}

	if response.Code != http.StatusBadRequest || payload.Error != api.OidcEmailRequired ||
		payload.Message != "An email claim is required for a new OIDC identity" {
		t.Fatalf("expected email-required error, got HTTP %d: %s", response.Code, response.Body)
	}

	if strings.Contains(response.Body.String(), "refreshToken") ||
		strings.Contains(response.Body.String(), "accessToken") {
		t.Fatal("missing email produced a session")
	}
}

func assertOIDCEmailRequiredRedirect(t *testing.T, response *httptest.ResponseRecorder) {
	t.Helper()

	redirect, err := url.Parse(response.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}

	query := redirect.Query()
	if response.Code != http.StatusFound || redirect.Host != getConfig().ClientURL.Host ||
		query.Get("error") != string(api.OidcEmailRequired) ||
		query.Get("errorDescription") != "An email claim is required for a new OIDC identity" ||
		query.Has("code") || query.Has("refreshToken") || query.Has("accessToken") {
		t.Fatalf(
			"expected email-required redirect without a session, got HTTP %d: %s",
			response.Code,
			redirect,
		)
	}
}
