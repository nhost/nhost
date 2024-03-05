package controller_test

import (
	"context"
	"net/url"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func ptr[T any](x T) *T { return &x }

func getConfig() *controller.Config {
	clientURL, _ := url.Parse("http://localhost:3000")
	serverURL, _ := url.Parse("https://local.auth.nhost.run")

	//nolint:lll
	return &controller.Config{
		HasuraGraphqlURL:         "http://localhost:8080/v1/graphql",
		HasuraAdminSecret:        "nhost-admin-secret",
		AllowedRedirectURLs:      []*url.URL{},
		ClientURL:                clientURL,
		CustomClaims:             "",
		ConcealErrors:            false,
		DisableSignup:            false,
		DisableNewUsers:          false,
		DefaultAllowedRoles:      []string{"user", "me"},
		DefaultRole:              "user",
		DefaultLocale:            "en",
		AllowedLocales:           []string{"en", "es", "ca", "se"},
		GravatarEnabled:          false,
		GravatarDefault:          "blank",
		GravatarRating:           "g",
		PasswordMinLength:        3,
		PasswordHIBPEnabled:      false,
		RefreshTokenExpiresIn:    2592000,
		AccessTokenExpiresIn:     900,
		JWTSecret:                `{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","issuer":"hasura-auth"}`,
		RequireEmailVerification: false,
		ServerURL:                serverURL,
	}
}

func TestValidatorPostSignupEmailPassword(t *testing.T) { //nolint:maintidx
	t.Parallel()

	cases := []struct {
		name        string
		cfg         func() *controller.Config
		hibp        func(ctrl *gomock.Controller) *mock.MockHIBPClient
		db          func(ctrl *gomock.Controller) *mock.MockSQLQueries
		request     api.PostSignupEmailPasswordRequestObject
		expected    api.PostSignupEmailPasswordRequestObject
		expectedErr error
	}{
		{
			name: "simple",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options:  nil,
				},
			},
			expected: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{
						AllowedRoles: ptr([]string{"user", "me"}),
						DefaultRole:  ptr("user"),
						DisplayName:  ptr("user@acme.com"),
						Locale:       ptr("en"),
						RedirectTo:   ptr("http://localhost:3000"),
						Metadata:     nil,
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "user exists",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, nil) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options:  nil,
				},
			},
			expected: api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{
				api.EmailAlreadyInUse,
			},
		},
		{
			name: "password too short",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p",
					Options:  nil,
				},
			},
			expected:    api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{"password-too-short"},
		},
		{
			name: "password in hibp database",
			cfg: func() *controller.Config {
				cfg := getConfig()
				cfg.PasswordHIBPEnabled = true
				return cfg
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				mock.EXPECT().IsPasswordPwned(
					gomock.Any(), "password",
				).Return(true, nil)
				return mock
			},
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expected:    api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{"password-in-hibp-database"},
		},
		{
			name: "password not in hibp database",
			cfg: func() *controller.Config {
				cfg := getConfig()
				cfg.PasswordHIBPEnabled = true
				return cfg
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				mock.EXPECT().IsPasswordPwned(
					gomock.Any(), "password",
				).Return(false, nil)
				return mock
			},
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expected: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "password",
					Options: &api.SignUpOptions{
						AllowedRoles: ptr([]string{"user", "me"}),
						DefaultRole:  ptr("user"),
						DisplayName:  ptr("user@acme.com"),
						Locale:       ptr("en"),
						RedirectTo:   ptr("http://localhost:3000"),
						Metadata:     nil,
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "options",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{
						AllowedRoles: ptr([]string{
							"me",
						}),
						DefaultRole: ptr("me"),
						DisplayName: ptr("My Name"),
						Locale:      ptr("ca"),
						Metadata: ptr(map[string]any{
							"key": "value",
						}),
						RedirectTo: ptr("http://localhost:3000"),
					},
				},
			},
			expected: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{
						AllowedRoles: ptr([]string{
							"me",
						}),
						DefaultRole: ptr("me"),
						DisplayName: ptr("My Name"),
						Locale:      ptr("ca"),
						Metadata: ptr(map[string]any{
							"key": "value",
						}),
						RedirectTo: ptr("http://localhost:3000"),
					},
				},
			},
			expectedErr: nil,
		},
		{
			name: "default role not in allowed roles",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{ //nolint:exhaustruct
						AllowedRoles: ptr([]string{
							"me",
						}),
						DefaultRole: ptr("user"),
					},
				},
			},
			expected:    api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{"default-role-must-be-in-allowed-roles"},
		},
		{
			name: "allowed roles not allowed",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{ //nolint:exhaustruct
						AllowedRoles: ptr([]string{
							"me",
							"user",
							"admin",
						}),
						DefaultRole: ptr("user"),
					},
				},
			},
			expected:    api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{"role-not-allowed"},
		},
		{
			name: "locale not allowed",
			cfg:  getConfig,
			hibp: mock.NewMockHIBPClient,
			db: func(ctrl *gomock.Controller) *mock.MockSQLQueries {
				mock := mock.NewMockSQLQueries(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("user@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "user@acme.com",
					Password: "p4ssw0rd",
					Options: &api.SignUpOptions{ //nolint:exhaustruct
						Locale: ptr("fr"),
					},
				},
			},
			expected:    api.PostSignupEmailPasswordRequestObject{}, //nolint:exhaustruct
			expectedErr: &controller.ValidationError{"locale-not-allowed"},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			ctrl := gomock.NewController(t)

			validator, err := controller.NewValidator(tc.cfg(), tc.db(ctrl), tc.hibp(ctrl))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			got, err := validator.PostSignupEmailPassword(context.Background(), tc.request)
			if diff := cmp.Diff(err, tc.expectedErr); diff != "" {
				t.Errorf("unexpected error (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(got, tc.expected); diff != "" {
				t.Errorf("unexpected request (-want +got):\n%s", diff)
			}
		})
	}
}

func TestValidateRedirectTo(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		allowedURLs []string
		redirectTos []string
		allowed     bool
	}{
		{
			name: "allowed",
			allowedURLs: []string{
				"http://localhost:3000",
				"https://acme.com/path",
				"https://*.acme.io",
				"https://*-sub.acme.io",
				"myapp://my.app",
			},
			redirectTos: []string{
				"http://localhost:3000",
				"http://localhost:3000/",
				"http://localhost:3000/subpath",
				"https://acme.com/path",
				"https://acme.com:443/path", // port is optional with http/https
				"https://acme.com/path/subpath",
				"https://acme.com/path/subpath?query=param#fragment",
				"https://acme.com/path?query=param#fragment",
				"https://acme.com/path/?query=param#fragment",
				"https://acme.com/path/?query=param#fragment",
				"https://subdomain.acme.io",
				"https://123subdomain.acme.io",
				"https://123-subdomain.acme.io",
				"https://asdasdsad-sub.acme.io",
				"https://asdasdsad-sub.acme.io",
				"myapp://my.app",
				"myapp://my.app/",
				"myapp://my.app/subpath",
			},
			allowed: true,
		},
		{
			name: "not allowed",
			allowedURLs: []string{
				"http://localhost:3000",
				"https://acme.com/path",
				"https://*.acme.io",
				"https://*-sub.acme.io",
				"http://simple.com",
			},
			redirectTos: []string{
				"https://localhost:3000", // scheme mismatch
				"http://localhost:4000",  // port mismatch
				"http://localhost",       // no port
				"http://prefixlocalhost:3000",
				"not-a-url",
				"https://",
				"https://acme.com/wrongpath",
				"https://subdomain.subdomain.acme.io", // only one wildcard in the url
				"https://acme.io",                     // bare is not allowed because we expect *.acme.io
				"https://-sub.acme.io",                // similar to above
				"https://simple.com.hijack.com",       // make sure anchors are set properly
				"https://simple.comhijack.com",        // make sure anchors are set properly
			},
			allowed: false,
		},
		{
			name:        "allow everything if empty",
			allowedURLs: []string{},
			redirectTos: []string{"https://localhost:3000"},
			allowed:     true,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			allowedURLs := make([]*url.URL, len(tc.allowedURLs))
			for i, u := range tc.allowedURLs {
				url, err := url.Parse(u)
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				allowedURLs[i] = url
			}

			fn, err := controller.ValidateRedirectTo(allowedURLs)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			for _, redirectTo := range tc.redirectTos {
				got := fn(redirectTo)
				if diff := cmp.Diff(got, tc.allowed); diff != "" {
					t.Errorf("unexpected result for %s (-want +got):\n%s", redirectTo, diff)
				}
			}
		})
	}
}
