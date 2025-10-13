package controller_test

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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
	"golang.org/x/crypto/bcrypt"
)

func cmpHashedPassword(password string) func(x, y string) bool {
	return func(x, y string) bool {
		if x != "" {
			if err := bcrypt.CompareHashAndPassword([]byte(x), []byte(password)); err != nil {
				return false
			}

			return true
		}

		if y != "" {
			if err := bcrypt.CompareHashAndPassword([]byte(y), []byte(password)); err != nil {
				return false
			}

			return true
		}

		if x == "" && y == "" {
			return true
		}

		return false
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

func cmpLink(x, y string) bool { //nolint:cyclop
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

	if ux.Scheme != uy.Scheme {
		return false
	}

	if ux.Host != uy.Host {
		return false
	}

	if ux.Path != uy.Path {
		return false
	}

	if len(ux.Query()) != len(uy.Query()) {
		return false
	}

	for k, v := range ux.Query() {
		if k == "ticket" {
			continue
		}

		if uy.Query().Get(k) != v[0] {
			return false
		}
	}

	return true
}

func cmpDBParams(
	i any,
	options ...cmp.Option,
) any {
	opts := append([]cmp.Option{
		testhelpers.FilterPathLast(
			[]string{".PasswordHash", "text()"},
			cmp.Comparer(cmpHashedPassword("password")),
		),
		testhelpers.FilterPathLast(
			[]string{".Ticket", "text()"},
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
			cmp.Comparer(func(x, y string) bool {
				return x != "" || y != ""
			}),
		),
		testhelpers.FilterPathLast(
			[]string{".NewRefreshTokenHash", "text()"},
			cmp.Comparer(func(x, y string) bool { return x != "" || y != "" }),
		),
	}, options...)

	return testhelpers.GomockCmpOpts(
		i, opts...,
	)
}

type testRequest[T, U any] struct {
	name              string
	config            func() *controller.Config
	db                func(ctrl *gomock.Controller) controller.DBClient
	jwtTokenFn        func() *jwt.Token
	request           T
	expectedResponse  U
	expectedJWT       *jwt.Token
	getControllerOpts []getControllerOptsFunc
}

type getControllerOpts struct {
	customClaimer             func(*gomock.Controller) controller.CustomClaimer
	emailer                   func(*gomock.Controller) *mock.MockEmailer
	sms                       func(*gomock.Controller) *mock.MockSMSer
	hibp                      func(*gomock.Controller) *mock.MockHIBPClient
	idTokenValidatorProviders func(t *testing.T) *oidc.IDTokenValidatorProviders
	totp                      *controller.Totp
}

type getControllerOptsFunc func(*getControllerOpts)

func withCusomClaimer(cc func(*gomock.Controller) controller.CustomClaimer) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.customClaimer = cc
	}
}

func withEmailer(emailer func(*gomock.Controller) *mock.MockEmailer) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.emailer = emailer
	}
}

func withSMS(sms func(*gomock.Controller) *mock.MockSMSer) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.sms = sms
	}
}

func withHIBP(hibp func(*gomock.Controller) *mock.MockHIBPClient) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.hibp = hibp
	}
}

func withIDTokenValidatorProviders(
	idTokenValidatorProviders func(t *testing.T) *oidc.IDTokenValidatorProviders,
) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.idTokenValidatorProviders = idTokenValidatorProviders
	}
}

func withTotp(totp *controller.Totp) getControllerOptsFunc {
	return func(o *getControllerOpts) {
		o.totp = totp
	}
}

func getController(
	t *testing.T,
	ctrl *gomock.Controller,
	configFn func() *controller.Config,
	db func(ctrl *gomock.Controller) controller.DBClient,
	opts ...getControllerOptsFunc,
) (*controller.Controller, *controller.JWTGetter) {
	t.Helper()

	config := *configFn()

	var controllerOpts getControllerOpts
	for _, o := range opts {
		o(&controllerOpts)
	}

	var cc controller.CustomClaimer
	if controllerOpts.customClaimer != nil {
		cc = controllerOpts.customClaimer(ctrl)
	}

	jwtGetter, err := controller.NewJWTGetter(
		jwtSecret,
		time.Second*time.Duration(config.AccessTokenExpiresIn),
		cc,
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("failed to create jwt getter: %v", err)
	}

	var emailer controller.Emailer
	if controllerOpts.emailer != nil {
		emailer = controllerOpts.emailer(ctrl)
	}

	var sms *mock.MockSMSer
	if controllerOpts.sms != nil {
		sms = controllerOpts.sms(ctrl)
	}

	var hibp controller.HIBPClient
	if controllerOpts.hibp != nil {
		hibp = controllerOpts.hibp(ctrl)
	}

	var idTokenValidator *oidc.IDTokenValidatorProviders
	if controllerOpts.idTokenValidatorProviders != nil {
		idTokenValidator = controllerOpts.idTokenValidatorProviders(t)
	}

	if controllerOpts.totp == nil {
		controllerOpts.totp = controller.NewTotp("auth", time.Now)
	}

	c, err := controller.New(
		db(ctrl),
		config,
		jwtGetter,
		emailer,
		sms,
		hibp,
		providers.Map{
			"fake": providers.NewFakeProvider(
				"client-id",
				"client-secret",
				"https://auth.nhost.dev",
				[]string{"openid", "email", "profile"},
			),
		},
		idTokenValidator,
		controllerOpts.totp,
		"dev",
	)
	if err != nil {
		t.Fatalf("failed to create controller: %v", err)
	}

	return c, jwtGetter
}

func assertRequest[T any, U any](
	ctx context.Context,
	t *testing.T,
	fn func(context.Context, T) (U, error),
	request T,
	expectedResponse U,
	options ...cmp.Option,
) U {
	t.Helper()

	resp, err := fn(ctx, request)
	if err != nil {
		t.Fatalf("failed to post signup email password: %v", err)
	}

	cmpopts := append([]cmp.Option{
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
		cmpopts.IgnoreFields(api.Session{}, "RefreshToken", "AccessToken"), //nolint:exhaustruct
	}, options...)

	if _, err := json.Marshal(resp); err != nil {
		t.Fatalf("failed to marshal response: %v", err)
	}

	if diff := cmp.Diff(
		resp, expectedResponse,
		cmpopts...,
	); diff != "" {
		t.Fatalf("unexpected response: %s", diff)
	}

	return resp
}

func assertSession(
	t *testing.T,
	jwtGetter *controller.JWTGetter,
	expectedSession *api.Session,
	expectedJWT *jwt.Token,
) {
	t.Helper()

	var (
		token *jwt.Token
		err   error
	)

	if expectedSession == nil {
		token = nil
	} else {
		token, err = jwtGetter.Validate(expectedSession.AccessToken)
		if err != nil {
			t.Fatalf("failed to get claims: %v", err)
		}
	}

	if diff := cmp.Diff(
		token,
		expectedJWT,
		cmpopts.IgnoreFields(jwt.Token{}, "Raw", "Signature"), //nolint:exhaustruct
		cmpopts.EquateApprox(0, 10),
	); diff != "" {
		t.Fatalf("unexpected jwt: %s", diff)
	}
}
