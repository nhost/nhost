package controller_test

import (
	"context"
	"net/url"
	"testing"
	"time"

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

func TestPostUserPasswordReset(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []struct {
		name             string
		config           func() *controller.Config
		db               func(ctrl *gomock.Controller) controller.DBClient
		emailer          func(ctrl *gomock.Controller) controller.Emailer
		request          api.PostUserPasswordResetRequestObject
		expectedResponse api.PostUserPasswordResetResponseObject
	}{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Disabled:      false,
					DisplayName:   "Jane Doe",
					Locale:        "en",
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
					IsAnonymous:   false,
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("passwordReset:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					"jane@acme.com",
					"en",
					notifications.TemplateNamePasswordReset,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordReset%3Ab66123b7-ea8b-4afe-a875-f201a2f8b224&type=passwordReset", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordReset:xxx",
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
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.PostUserPasswordReset200JSONResponse(api.OK),
		},

		{
			name: "with redirectTo",
			config: func() *controller.Config {
				cfg := getConfig()
				u, _ := url.Parse("https://myapp.com")
				cfg.AllowedRedirectURLs = []*url.URL{u}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Disabled:      false,
					DisplayName:   "Jane Doe",
					Locale:        "en",
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
					IsAnonymous:   false,
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("passwordReset:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					"jane@acme.com",
					"en",
					notifications.TemplateNamePasswordReset,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=https%3A%2F%2Fmyapp.com&ticket=passwordReset%3Adadf0554-f118-4446-bfb1-2487b05cf251&type=passwordReset", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordReset:xxx",
							RedirectTo:  "https://myapp.com",
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
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://myapp.com"),
					},
				},
			},
			expectedResponse: api.PostUserPasswordReset200JSONResponse(api.OK),
		},

		{
			name:   "with wrong redirectTo",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://myapp.com"),
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
			name: "with email not allowed",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedEmails = []string{"john@acme.com"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: `Incorrect email or password`,
				Status:  401,
			},
		},

		{
			name:   "no user found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-not-found",
				Message: "No user found",
				Status:  400,
			},
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Disabled:      true,
					DisplayName:   "Jane Doe",
					Locale:        "en",
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
					IsAnonymous:   false,
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
		},

		{
			name: "email not verified",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.RequireEmailVerification = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Disabled:      false,
					DisplayName:   "Jane Doe",
					Locale:        "en",
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
					IsAnonymous:   false,
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) controller.Emailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserPasswordResetRequestObject{
				Body: &api.PostUserPasswordResetJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
		},
	}

	for _, tc := range cases { //nolint:dupl
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
			)
			if err != nil {
				t.Fatalf("failed to create controller: %v", err)
			}

			resp, err := c.PostUserPasswordReset(context.Background(), tc.request)
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
