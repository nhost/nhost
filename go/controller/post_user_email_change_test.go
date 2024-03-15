package controller_test

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
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

func TestPostUserEmailChange(t *testing.T) { //nolint:maintidx
	t.Parallel()

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
					"x-hasura-allowed-roles":    []any{"user", "me"},
					"x-hasura-default-role":     "user",
					"x-hasura-user-id":          "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-isAnonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []struct {
		name             string
		config           func() *controller.Config
		db               func(ctrl *gomock.Controller) controller.DBClient
		emailer          func(ctrl *gomock.Controller) controller.Emailer
		jwtTokenFn       func() *jwt.Token
		request          api.PostUserEmailChangeRequestObject
		expectedResponse api.PostUserEmailChangeResponseObject
	}{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

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
				).Return(sql.UpdateUserChangeEmailRow{
					ID:          uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
					Locale:      "en",
					DisplayName: "Jane Doe",
					Email:       sql.Text("oldEmail@acme.com"),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
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
		},

		{
			name:   "wrong subject",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				jwtToken := jwtTokenFn()
				jwtToken.Claims.(jwt.MapClaims)["sub"] = "garbage" //nolint:forcetypeassert
				return jwtToken
			},
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
		},

		{
			name:   "missing anonymous claim",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				jwtToken := jwtTokenFn()
				//nolint:forcetypeassert
				cc := jwtToken.Claims.(jwt.MapClaims)["https://hasura.io/jwt/claims"].(map[string]any)
				delete(cc, "x-hasura-user-isAnonymous")
				return jwtToken
			},
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
		},

		{
			name:   "anonymous claim is garbage",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				jwtToken := jwtTokenFn()
				//nolint:forcetypeassert
				cc := jwtToken.Claims.(jwt.MapClaims)["https://hasura.io/jwt/claims"].(map[string]any)
				cc["x-hasura-user-isAnonymous"] = "garbage"
				return jwtToken
			},
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
		},

		{
			name:   "anonymous claim is true",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			jwtTokenFn: func() *jwt.Token {
				jwtToken := jwtTokenFn()
				//nolint:forcetypeassert
				cc := jwtToken.Claims.(jwt.MapClaims)["https://hasura.io/jwt/claims"].(map[string]any)
				cc["x-hasura-user-isAnonymous"] = "true"
				return jwtToken
			},
			request: api.PostUserEmailChangeRequestObject{
				Body: &api.UserEmailChangeRequest{
					NewEmail: "newEmail@acme.com",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
		},

		{
			name:   "user with newEmail already exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("newEmail@acme.com"),
				).Return(sql.AuthUser{}, nil) //nolint:exhaustruct

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
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
		},

		{
			name: "simple with redirect",
			config: func() *controller.Config {
				r, _ := url.Parse("https://myapp/redirect")

				cfg := getConfig()
				cfg.AllowedRedirectURLs = []*url.URL{r}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

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
				).Return(sql.UpdateUserChangeEmailRow{
					ID:          uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb"),
					Locale:      "en",
					DisplayName: "Jane Doe",
					Email:       sql.Text("oldEmail@acme.com"),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
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
		},

		{
			name:   "wrong redirect",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
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
				Error:   "redirecTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
		},

		{
			name:   "user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

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
				).Return(sql.UpdateUserChangeEmailRow{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
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
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			ctrl := gomock.NewController(t)

			jwtGetter, err := controller.NewJWTGetter(
				jwtSecret,
				time.Second*time.Duration(tc.config().AccessTokenExpiresIn),
				nil,
			)
			if err != nil {
				t.Fatalf("failed to create jwt getter: %v", err)
			}

			c, err := controller.New(
				tc.db(ctrl),
				*tc.config(),
				jwtGetter,
				tc.emailer(ctrl),
				nil,
				"dev",
			)
			if err != nil {
				t.Fatalf("failed to create controller: %v", err)
			}

			ctx := jwtGetter.ToContext(context.Background(), tc.jwtTokenFn())
			resp, err := c.PostUserEmailChange(ctx, tc.request)
			if err != nil {
				t.Fatalf("failed to post signup email password: %v", err)
			}

			if diff := cmp.Diff(
				resp, tc.expectedResponse,
				testhelpers.FilterPathLast(
					[]string{".CreatedAt"}, cmpopts.EquateApproxTime(time.Minute),
				),
				cmp.Transformer("floatify", func(x int64) float64 {
					return float64(x)
				}),
				cmpopts.EquateApprox(0, 10),
				cmpopts.IgnoreFields(api.Session{}, "RefreshToken", "AccessToken"), //nolint:exhaustruct
			); diff != "" {
				t.Fatalf("unexpected response: %s", diff)
			}
		})
	}
}
