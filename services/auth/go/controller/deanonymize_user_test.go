package controller_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestDeanonymizeUser(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	jwtTokenFn := func() *jwt.Token {
		return &jwt.Token{
			Raw:    "",
			Method: jwt.SigningMethodHS256,
			Header: map[string]any{
				"alg": "HS256",
				"typ": "JWT",
			},
			Claims: jwt.MapClaims{
				"exp": float64(time.Now().Add(900 * time.Second).Unix()),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"anonymous"},
					"x-hasura-default-role":      "anonymous",
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "true",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.DeanonymizeUserRequestObject, api.DeanonymizeUserResponseObject]{
		{
			name:   "email-password - no email verification",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymize(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeParams{
						Roles:       []string{"user", "me"},
						Email:       sql.Text("jane@acme.com"),
						DefaultRole: sql.Text("user"),
						DisplayName: sql.Text("jane@acme.com"),
						Locale:      sql.Text("en"),
						Metadata:    nil,
						PasswordHash: sql.Text(
							"$2a$10$QwRLalqNq5jxjXNH6KUonuNYLhIFiyMo7JKplF2TOQsUfquoNqqq6",
						),
						Ticket:          sql.Text(""),
						TicketExpiresAt: sql.TimestampTz(time.Time{}),
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					}),
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("password"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse:  api.DeanonymizeUser200JSONResponse(api.OK),
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "email-password - no email verification - options",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymize(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeParams{
						Roles:       []string{"user"},
						Email:       sql.Text("jane@acme.com"),
						DefaultRole: sql.Text("user"),
						DisplayName: sql.Text("Jane"),
						Locale:      sql.Text("en"),
						Metadata:    []byte(`{"key":"value"}`),
						PasswordHash: sql.Text(
							"$2a$10$QwRLalqNq5jxjXNH6KUonuNYLhIFiyMo7JKplF2TOQsUfquoNqqq6",
						),
						Ticket:          sql.Text(""),
						TicketExpiresAt: sql.TimestampTz(time.Time{}),
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					}),
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection: nil,
					Email:      "jane@acme.com",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"user"},
						DefaultRole:  new("user"),
						DisplayName:  new("Jane"),
						Locale:       new("fr"),
						Metadata: &map[string]any{
							"key": "value",
						},
						RedirectTo: new("http://localhost:3000/redirect"),
					},
					Password:     new("password"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse:  api.DeanonymizeUser200JSONResponse(api.OK),
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "email-password - email verification",
			config: func() *controller.Config {
				config := getConfig()
				config.RequireEmailVerification = true

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymize(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeParams{
						Roles:       []string{"user", "me"},
						Email:       sql.Text("jane@acme.com"),
						DefaultRole: sql.Text("user"),
						DisplayName: sql.Text("jane@acme.com"),
						Locale:      sql.Text("en"),
						Metadata:    nil,
						PasswordHash: sql.Text(
							"$2a$10$QwRLalqNq5jxjXNH6KUonuNYLhIFiyMo7JKplF2TOQsUfquoNqqq6",
						),
						Ticket:          sql.Text("verifyEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					}),
				).Return(nil)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(), userID,
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("password"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse: api.DeanonymizeUser200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
						"jane@acme.com",
						"en",
						notifications.TemplateNameEmailVerify,
						testhelpers.GomockCmpOpts(
							notifications.TemplateData{
								Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=verifyEmail%3Ab2a8b9c1-ab7e-4602-ac97-86baf828157a&type=emailVerify", //nolint:lll
								DisplayName: "jane@acme.com",
								Email:       "jane@acme.com",
								NewEmail:    "",
								Ticket:      "verifyEmail:xxx",
								RedirectTo:  "http://localhost:3000",
								Locale:      "en",
								ServerURL:   "https://local.auth.nhost.run",
								ClientURL:   "http://localhost:3000",
							},
							testhelpers.FilterPathLast(
								[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

							testhelpers.FilterPathLast(
								[]string{".Link"}, cmp.Comparer(cmpLink)),
						)).Return(nil)

					return mock
				}),
			},
		},

		{
			name:   "email-passwordless",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymize(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeParams{
						Roles:           []string{"user", "me"},
						Email:           sql.Text("jane@acme.com"),
						DefaultRole:     sql.Text("user"),
						DisplayName:     sql.Text("jane@acme.com"),
						Locale:          sql.Text("en"),
						Metadata:        nil,
						PasswordHash:    sql.Text(""),
						Ticket:          sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					}),
				).Return(nil)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(), userID,
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("password"),
					SignInMethod: "passwordless",
				},
			},
			expectedResponse: api.DeanonymizeUser200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
						"jane@acme.com",
						"en",
						notifications.TemplateNameSigninPasswordless,
						testhelpers.GomockCmpOpts(
							notifications.TemplateData{
								Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordlessEmail%3Ac000a5b3-d3af-4937-aa2e-cc86f19ee565&type=signinPasswordless", //nolint:lll
								DisplayName: "jane@acme.com",
								Email:       "jane@acme.com",
								NewEmail:    "",
								Ticket:      "passwordlessEmail:xxx",
								RedirectTo:  "http://localhost:3000",
								Locale:      "en",
								ServerURL:   "https://local.auth.nhost.run",
								ClientURL:   "http://localhost:3000",
							},
							testhelpers.FilterPathLast(
								[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

							testhelpers.FilterPathLast(
								[]string{".Link"}, cmp.Comparer(cmpLink)),
						)).Return(nil)

					return mock
				}),
			},
		},

		{
			name:   "email-password - missing password",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     nil,
					SignInMethod: "email-password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "email-password - short password",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("a"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "password-too-short",
				Message: "Password is too short",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user not anonymous",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				token := jwtTokenFn()
				m, _ := token.Claims.(jwt.MapClaims)
				claims, _ := m["https://hasura.io/jwt/claims"].(map[string]any)
				claims["x-hasura-user-is-anonymous"] = "false"

				return token
			},
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("asdasdqweqwe"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-not-anonymous",
				Message: "Logged in user is not anonymous",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "email already exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, nil) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("password"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "email-already-in-use",
				Message: "Email already in use",
				Status:  409,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "email not allowed",
			config: func() *controller.Config {
				config := getConfig()
				config.AllowedEmails = []string{"jane@acme.corp"}

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserRequestObject{
				Body: &api.UserDeanonymizeRequest{
					Connection:   nil,
					Email:        "jane@acme.com",
					Options:      nil,
					Password:     new("password"),
					SignInMethod: "email-password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			assertRequest(
				ctx, t, c.DeanonymizeUser, tc.request, tc.expectedResponse,
			)
		})
	}
}
