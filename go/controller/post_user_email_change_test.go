package controller_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

//nolint:dupl
func TestPostUserEmailChange(t *testing.T) { //nolint:maintidx
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
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.PostUserEmailChangeRequestObject, api.PostUserEmailChangeResponseObject]{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("newEmail@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().UpdateUserChangeEmail(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserChangeEmailParams{
						ID:              uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
						Ticket:          sql.Text("emailConfirmChange:xxxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						NewEmail:        sql.Text("newEmail@acme.com"),
					}),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
					Locale:      "en",
					DisplayName: "Jane Doe",
					Email:       sql.Text("oldEmail@acme.com"),
					Ticket:      sql.Text("emailConfirmChange:xxxxx"),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"newEmail@acme.com",
					"en",
					notifications.TemplateNameEmailConfirmChange,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=emailConfirmChange%3A9bd37c9c-8f5b-4c19-af01-a729922c1952&type=emailConfirmChange", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "oldEmail@acme.com",
							NewEmail:    "newEmail@acme.com",
							Ticket:      "emailConfirmChange:xxx",
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
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: api.PostUserEmailChange200JSONResponse(api.OK),
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name:   "user with newEmail already exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("newEmail@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					Email: sql.Text("newEmail@acme.com"),
				}, nil)

				return mock
			},

			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "email-already-in-use",
				Message: "Email already in use",
				Status:  409,
			},
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "failed to get user with newEmail",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("newEmail@acme.com"),
				).Return(sql.AuthUser{}, errors.New("some error")) //nolint:exhaustruct,goerr113

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name: "simple with redirect",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedRedirectURLs = []string{"https://myapp/redirect"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("newEmail@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().UpdateUserChangeEmail(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserChangeEmailParams{
						ID:              uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
						Ticket:          sql.Text("emailConfirmChange:xxxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						NewEmail:        sql.Text("newEmail@acme.com"),
					}),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
					Locale:      "en",
					DisplayName: "Jane Doe",
					Email:       sql.Text("oldEmail@acme.com"),
					Ticket:      sql.Text("emailConfirmChange:xxxxx"),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"newEmail@acme.com",
					"en",
					notifications.TemplateNameEmailConfirmChange,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=https%3A%2F%2Fmyapp%2Fredirect&ticket=emailConfirmChange%3A4c84b833-d330-49a6-b509-6c090959e249&type=emailConfirmChange", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "oldEmail@acme.com",
							NewEmail:    "newEmail@acme.com",
							Ticket:      "emailConfirmChange:xxx",
							RedirectTo:  "https://myapp/redirect",
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
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://myapp/redirect"),
					},
				},
			},
			expectedResponse: api.PostUserEmailChange200JSONResponse(api.OK),
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name:   "wrong redirect",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://myapp/redirect"),
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: nil,
				emailer:       tc.emailer,
				hibp:          nil,
			})

			ctx := jwtGetter.ToContext(context.Background(), tc.jwtTokenFn())
			assertRequest(
				ctx, t, c.PostUserEmailChange, tc.request, tc.expectedResponse,
			)
		})
	}
}
