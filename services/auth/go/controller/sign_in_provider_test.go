package controller_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
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
				Params:   api.SignInProviderParams{}, //nolint:exhaustruct
				Provider: "fake",
			},
			expectedResponse: api.SignInProvider302Response{
				Headers: api.SignInProvider302ResponseHeaders{
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`, //nolint:lll
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
					Location: `^https://accounts.fake.com/o/oauth2/auth\?client_id=client-id&redirect_uri=https%3A%2F%2Fauth.nhost.dev%2Fsignin%2Fprovider%2Ffake%2Fcallback&response_type=code&scope=openid\+email\+profile&state=.*$`, //nolint:lll
				},
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
				Params: api.SignInProviderParams{ //nolint:exhaustruct
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
				Params:   api.SignInProviderParams{}, //nolint:exhaustruct
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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			assertRequest(
				t.Context(),
				t,
				c.SignInProvider,
				tc.request,
				tc.expectedResponse,
				cmp.FilterPath(func(p cmp.Path) bool {
					if last := p.Last(); last != nil {
						return last.String() == ".Location" || last.String() == ".SetCookie"
					}

					return false
				}, RegexpComparer()),
			)
		})
	}
}
