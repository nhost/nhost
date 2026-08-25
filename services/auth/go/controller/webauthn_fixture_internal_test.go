package controller

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	crypto "github.com/nhost/nhost/services/auth/go/cryto"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func ptr[T any](x T) *T { return new(x) }

func getConfig() *Config {
	clientURL, _ := url.Parse("http://localhost:3000")
	serverURL, _ := url.Parse("https://local.auth.nhost.run")

	return &Config{
		AnonymousUsersEnabled:                    false,
		HasuraGraphqlURL:                         "http://localhost:8080/v1/graphql",
		HasuraAdminSecret:                        "nhost-admin-secret",
		AllowedEmailDomains:                      []string{},
		AllowedEmails:                            []string{},
		AllowedRedirectURLs:                      []string{},
		BlockedEmailDomains:                      []string{},
		BlockedEmails:                            []string{},
		ClientURL:                                clientURL,
		CustomClaims:                             "",
		CustomClaimsDefaults:                     "",
		ConcealErrors:                            false,
		DisableSignup:                            false,
		DisableNewUsers:                          false,
		DefaultAllowedRoles:                      []string{"user", "me"},
		DefaultRole:                              "user",
		DefaultLocale:                            "en",
		AllowedLocales:                           []string{"en", "es", "ca", "se"},
		GravatarEnabled:                          false,
		GravatarDefault:                          "blank",
		GravatarRating:                           "g",
		PasswordMinLength:                        3,
		PasswordHIBPEnabled:                      false,
		RefreshTokenExpiresIn:                    2592000,
		AccessTokenExpiresIn:                     900,
		JWTSecret:                                `{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","issuer":"hasura-auth"}`,
		RequireEmailVerification:                 false,
		ServerURL:                                serverURL,
		EmailPasswordlessEnabled:                 false,
		WebauthnEnabled:                          true,
		WebauthnRPID:                             "react-apollo.example.nhost.io",
		WebauthnRPName:                           "React Apollo Example",
		WebauthnRPOrigins:                        []string{"https://react-apollo.example.nhost.io"},
		WebauhtnAttestationTimeout:               time.Minute,
		OTPEmailEnabled:                          true,
		MfaEnabled:                               true,
		ServerPrefix:                             "",
		SMSPasswordlessEnabled:                   true,
		SMSProvider:                              "twilio",
		SMSTwilioAccountSid:                      "smsAccountSid",
		SMSTwilioAuthToken:                       "smsAuthToken",
		SMSTwilioMessagingServiceID:              "smsMessagingServiceID",
		SMSModicaUsername:                        "modicaUsername",
		SMSModicaPassword:                        "modicaPassword",
		DisableAutoSignup:                        false,
		OAuth2ProviderEnabled:                    false,
		OAuth2ProviderLoginURL:                   "",
		OAuth2ProviderAccessTokenTTL:             900,
		OAuth2ProviderRefreshTokenTTL:            2592000,
		OAuth2ProviderCIMDEnabled:                false,
		OAuth2ProviderCIMDAllowInsecureTransport: false,
		SMSGenericURL:                            "",
		SMSGenericContentType:                    "",
		SMSGenericHeaders:                        "",
		SMSGenericTimeout:                        0,
		SMSGenericBodyTemplate:                   "",
	}
}

func cmpTicket(x, y string) bool {
	if x == "" && y == "" {
		return true
	}

	px := strings.Split(x, ":")
	if len(px) == 2 {
		py := strings.Split(y, ":")
		if len(py) != 2 {
			return false
		}

		return px[0] == py[0]
	}

	if len(px) == 1 {
		py := strings.Split(y, ":")
		if len(py) == 1 {
			return true
		}
	}

	return false
}

func cmpLink(x, y string) bool {
	if x == y {
		return true
	}

	ux, err := url.Parse(x)
	if err != nil {
		return false
	}

	uy, err := url.Parse(y)
	if err != nil {
		return false
	}

	if ux.Scheme != uy.Scheme || ux.Host != uy.Host || ux.Path != uy.Path {
		return false
	}

	if len(ux.Query()) != len(uy.Query()) {
		return false
	}

	for key, values := range ux.Query() {
		if key == "ticket" {
			continue
		}

		if uy.Query().Get(key) != values[0] {
			return false
		}
	}

	return true
}

func cmpDBParams(value any) any {
	opts := []cmp.Option{
		testhelpers.FilterPathLast(
			[]string{".Ticket", "text()"},
			cmp.Comparer(cmpTicket),
		),
		testhelpers.FilterPathLast(
			[]string{".Otp"},
			cmp.Comparer(cmpTicket),
		),
		cmp.Transformer("time", func(x pgtype.Timestamptz) time.Time {
			return x.Time
		}),
		cmp.Transformer("text", func(x pgtype.Text) string {
			return x.String
		}),
		testhelpers.FilterPathLast(
			[]string{".TicketExpiresAt", "time()"}, cmpopts.EquateApproxTime(time.Minute),
		),
		testhelpers.FilterPathLast(
			[]string{".RefreshTokenExpiresAt", "time()"}, cmpopts.EquateApproxTime(time.Minute),
		),
		testhelpers.FilterPathLast(
			[]string{".ExpiresAt", "time()"}, cmpopts.EquateApproxTime(time.Minute),
		),
		testhelpers.FilterPathLast(
			[]string{".RefreshTokenHash", "text()"},
			cmp.Comparer(func(x, y string) bool { return x != "" || y != "" }),
		),
	}

	return testhelpers.GomockCmpOpts(value, opts...)
}

type testRequest[T, U any] struct {
	name              string
	config            func() *Config
	db                func(ctrl *gomock.Controller) DBClient
	jwtTokenFn        func() *jwt.Token
	request           T
	expectedResponse  U
	expectedJWT       *jwt.Token
	getControllerOpts []getControllerOptsFunc
}

type getControllerOpts struct {
	emailer func(*gomock.Controller) *mock.MockEmailer
}

type getControllerOptsFunc func(*getControllerOpts)

func withEmailer(emailer func(*gomock.Controller) *mock.MockEmailer) getControllerOptsFunc {
	return func(options *getControllerOpts) {
		options.emailer = emailer
	}
}

func getController(
	t *testing.T,
	mockController *gomock.Controller,
	configFn func() *Config,
	db func(ctrl *gomock.Controller) DBClient,
	opts ...getControllerOptsFunc,
) (*Controller, *JWTGetter) {
	t.Helper()

	config := *configFn()

	var controllerOpts getControllerOpts
	for _, option := range opts {
		option(&controllerOpts)
	}

	jwtGetter, err := NewJWTGetter(
		[]byte(config.JWTSecret),
		time.Second*time.Duration(config.AccessTokenExpiresIn),
		nil,
		"",
		nil,
		config.ServerURL.String(),
	)
	if err != nil {
		t.Fatalf("failed to create jwt getter: %v", err)
	}

	var emailer Emailer
	if controllerOpts.emailer != nil {
		emailer = controllerOpts.emailer(mockController)
	}

	encrypter, err := crypto.NewEncrypterFromString(
		"41e7109ea7cfff9e4100d29bbd58bacab0258d0fc4c0495746ed0cf166650f9d",
	)
	if err != nil {
		t.Fatalf("failed to create encrypter: %v", err)
	}

	ctrl, err := New(
		db(mockController),
		config,
		jwtGetter,
		emailer,
		nil,
		nil,
		providers.Map{
			"fake": providers.NewFakeProvider(
				"client-id",
				"client-secret",
				"https://auth.nhost.dev",
				[]string{"openid", "email", "profile"},
			),
		},
		nil,
		NewTotp("auth", time.Now),
		encrypter,
		"dev",
	)
	if err != nil {
		t.Fatalf("failed to create controller: %v", err)
	}

	return ctrl, jwtGetter
}

func assertRequest[T, U any](
	ctx context.Context,
	t *testing.T,
	fn func(context.Context, T) (U, error),
	request T,
	expectedResponse U,
	options ...cmp.Option,
) U {
	t.Helper()

	response, err := fn(ctx, request)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	cmpOptions := append([]cmp.Option{
		testhelpers.FilterPathLast(
			[]string{".CreatedAt"}, cmpopts.EquateApproxTime(time.Minute),
		),
		cmp.Transformer("floatify", func(x int64) float64 {
			return float64(x)
		}),
		cmpopts.EquateApprox(0, 10),
		testhelpers.FilterPathLast(
			[]string{".Ticket"}, cmp.Comparer(cmpTicket),
		),
		cmpopts.IgnoreFields(api.Session{}, "RefreshToken", "AccessToken"),
	}, options...)

	if _, err := json.Marshal(response); err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	if diff := cmp.Diff(response, expectedResponse, cmpOptions...); diff != "" {
		t.Fatalf("unexpected response: %s", diff)
	}

	return response
}

func assertSession(
	t *testing.T,
	jwtGetter *JWTGetter,
	expectedSession *api.Session,
	expectedJWT *jwt.Token,
) {
	t.Helper()

	var (
		token *jwt.Token
		err   error
	)

	if expectedSession != nil {
		token, err = jwtGetter.Validate(expectedSession.AccessToken)
		if err != nil {
			t.Fatalf("failed to get claims: %v", err)
		}
	}

	if diff := cmp.Diff(
		token,
		expectedJWT,
		cmpopts.IgnoreFields(jwt.Token{}, "Raw", "Signature"),
		cmpopts.EquateApprox(0, 10),
	); diff != "" {
		t.Fatalf("unexpected jwt: %s", diff)
	}
}

func getSigninUser(userID uuid.UUID) sql.AuthUser {
	return sql.AuthUser{
		ID: userID,
		CreatedAt: pgtype.Timestamptz{
			Time: time.Now(),
		},
		UpdatedAt:   pgtype.Timestamptz{},
		LastSeen:    pgtype.Timestamptz{},
		Disabled:    false,
		DisplayName: "Jane Doe",
		AvatarUrl:   "",
		Locale:      "en",
		Email:       sql.Text("jane@acme.com"),
		PhoneNumber: pgtype.Text{},
		PasswordHash: sql.Text(
			"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
		),
		EmailVerified:            true,
		PhoneNumberVerified:      false,
		NewEmail:                 pgtype.Text{},
		OtpMethodLastUsed:        pgtype.Text{},
		OtpHash:                  pgtype.Text{},
		OtpHashExpiresAt:         pgtype.Timestamptz{},
		DefaultRole:              "user",
		IsAnonymous:              false,
		TotpSecret:               pgtype.Text{},
		ActiveMfaType:            pgtype.Text{},
		Ticket:                   pgtype.Text{},
		TicketExpiresAt:          pgtype.Timestamptz{},
		Metadata:                 []byte("{}"),
		WebauthnCurrentChallenge: pgtype.Text{},
	}
}

func webauthnChallengeCount(webauthn *Webauthn) int {
	webauthn.storageMu.RLock()
	defer webauthn.storageMu.RUnlock()

	return len(webauthn.storage)
}
