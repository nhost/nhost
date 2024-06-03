package controller_test

import (
	"context"
	"errors"
	"testing"
	"time"

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
func TestPostUserEmailSendVerificationEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	//nolint:lll
	cases := []testRequest[api.PostUserEmailSendVerificationEmailRequestObject, api.PostUserEmailSendVerificationEmailResponseObject]{
		{
			name: "success with email verification requied",
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
					DisplayName:   "jane@acme.com",
					EmailVerified: false,
					Email:         sql.Text("jane@acme.com"),
					Locale:        "en",
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("verifyEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(720 * time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameEmailVerify,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=verifyEmail%3A55fa0d55-631c-490a-a744-b5feca4c22a1&type=emailVerify", //nolint:lll
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
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.PostUserEmailSendVerificationEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name: "success without email verification requied",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.RequireEmailVerification = false
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					DisplayName:   "jane@acme.com",
					EmailVerified: false,
					Email:         sql.Text("jane@acme.com"),
					Locale:        "en",
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("verifyEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(720 * time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameEmailVerify,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=verifyEmail%3A55fa0d55-631c-490a-a744-b5feca4c22a1&type=emailVerify", //nolint:lll
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
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.PostUserEmailSendVerificationEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name: "success with redirctTo",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedRedirectURLs = []string{"https://myapp.com"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					DisplayName:   "jane@acme.com",
					EmailVerified: false,
					Email:         sql.Text("jane@acme.com"),
					Locale:        "en",
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("verifyEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(720 * time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameEmailVerify,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=https%3A%2F%2Fmyapp.com%2Fverify&ticket=verifyEmail%3Ad108332c-1f95-43b3-ade2-6206316c8985&type=emailVerify", //nolint:lll
							DisplayName: "jane@acme.com",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "verifyEmail:xxx",
							RedirectTo:  "https://myapp.com/verify",
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
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://myapp.com/verify"),
					},
				},
			},
			expectedResponse: api.PostUserEmailSendVerificationEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name: "wrong redirctTo",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedRedirectURLs = []string{"http://myapp"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: ptr("https://evil.com/verify"),
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
			jwtTokenFn:    nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "user doesn't exist",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			jwtTokenFn:    nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
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
					DisplayName:   "jane@acme.com",
					EmailVerified: false,
					Email:         sql.Text("jane@acme.com"),
					Locale:        "en",
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			jwtTokenFn:    nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "already verified",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					DisplayName:   "jane@acme.com",
					EmailVerified: true,
					Email:         sql.Text("jane@acme.com"),
					Locale:        "en",
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "email-already-verified",
				Message: "User's email is already verified",
				Status:  400,
			},
			jwtTokenFn:    nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "random error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, errors.New("error")) //nolint:exhaustruct,goerr113

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostUserEmailSendVerificationEmailRequestObject{
				Body: &api.PostUserEmailSendVerificationEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:    nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: nil,
				emailer:       tc.emailer,
				hibp:          nil,
			})

			assertRequest(
				context.Background(),
				t,
				c.PostUserEmailSendVerificationEmail,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
