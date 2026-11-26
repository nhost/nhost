package controller_test

import (
	"net/url"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestSignInProvider(t *testing.T) {
	t.Parallel()

	cases := []testRequest[api.SignInProviderRequestObject, api.SignInProviderResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params:   api.SignInProviderParams{},
				Provider: "fake",
			},
			expectedResponse: api.SignInProvider302Response{
				Headers: api.SignInProvider302ResponseHeaders{
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "success with options and state",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					AllowedRoles:           &[]string{"admin", "user"},
					DefaultRole:            new("admin"),
					DisplayName:            new("Test User"),
					Locale:                 new("es"),
					Metadata:               new(map[string]any{"key": "value"}),
					RedirectTo:             new("http://localhost:3000/redirect"),
					Connect:                new("asdasd"),
					State:                  new("custom-state"),
					ProviderSpecificParams: nil,
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProvider302Response{
				Headers: api.SignInProvider302ResponseHeaders{
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "success with code challenge",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					CodeChallenge: ptr("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProvider302Response{
				Headers: api.SignInProvider302ResponseHeaders{
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "invalid code challenge format",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					CodeChallenge: ptr("too-short"),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "redirectTo now allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					RedirectTo: new("http://not.allowed.com"),
				},
				Provider: "not-enabled",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "provider not enabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params:   api.SignInProviderParams{},
				Provider: "not-enabled",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct {
					Location string
				}{
					Location: `http://localhost:3000?error=disabled-endpoint&errorDescription=This+endpoint+is+disabled`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "success with upstreamParams forwarded to provider",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					UpstreamParams: &api.UpstreamAuthParams{
						"prompt":     "select_account",
						"login_hint": "user@example.com",
					},
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProvider302Response{
				Headers: api.SignInProvider302ResponseHeaders{
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&login_hint=user%40example.com&prompt=select_account&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "reserved upstreamParams key is rejected",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderRequestObject{
				Params: api.SignInProviderParams{
					UpstreamParams: &api.UpstreamAuthParams{
						"redirect_uri": "https://evil.example.com",
					},
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct {
					Location string
				}{
					Location: `http://localhost:3000?error=invalid-request&errorDescription=The+request+payload+is+incorrect`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			response := assertRequest(
				t.Context(),
				t,
				c.SignInProvider,
				tc.request,
				tc.expectedResponse,
				testhelpers.FilterPathLast([]string{".Location"}, RegexpComparer()),
				testhelpers.FilterPathLast([]string{".SetCookie"}, RegexpComparer()),
			)

			redirect, ok := response.(api.SignInProvider302Response)
			if !ok {
				return
			}

			params := tc.request.Params
			assertProviderRedirectState(
				t, jwtGetter, redirect.Headers.Location, tc.config().ClientURL.String(),
				providers.State{
					Connect: params.Connect,
					Options: &api.SignUpOptions{
						AllowedRoles: params.AllowedRoles,
						DefaultRole:  params.DefaultRole,
						DisplayName:  params.DisplayName,
						Locale:       params.Locale,
						Metadata:     params.Metadata,
						RedirectTo:   params.RedirectTo,
					},
					State:         params.State,
					Flow:          providers.FlowSignin,
					CodeChallenge: params.CodeChallenge,
				},
			)
		})
	}
}

func assertProviderRedirectState(
	t *testing.T,
	jwtGetter *controller.JWTGetter,
	location, defaultRedirectTo string,
	want providers.State,
) {
	t.Helper()

	if want.Options.RedirectTo == nil {
		want.Options.RedirectTo = &defaultRedirectTo
	}

	providerURL, err := url.Parse(location)
	if err != nil {
		t.Fatalf("parse provider URL: %v", err)
	}

	token, err := jwtGetter.Validate(providerURL.Query().Get("state"))
	if err != nil {
		t.Fatalf("validate provider state token: %v", err)
	}

	var got providers.State
	if err := got.Decode(token.Claims); err != nil {
		t.Fatalf("decode provider state: %v", err)
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("provider state mismatch (-want +got):\n%s", diff)
	}
}
