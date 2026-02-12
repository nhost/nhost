package controller_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestSendPasswordResetEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.SendPasswordResetEmailRequestObject, api.SendPasswordResetEmailResponseObject]{
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:      nil,
			jwtTokenFn:       nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
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
				}),
			},
		},

		{
			name: "with redirectTo",
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: new("https://myapp.com"),
					},
				},
			},
			expectedResponse: api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:      nil,
			jwtTokenFn:       nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
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
				}),
			},
		},

		{
			name:   "with wrong redirectTo",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email: "jane@acme.com",
					Options: &api.OptionsRedirectTo{
						RedirectTo: new("https://myapp.com"),
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.SendPasswordResetEmailRequestObject{
				Body: &api.SendPasswordResetEmailJSONRequestBody{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SendPasswordResetEmail200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			assertRequest(
				t.Context(), t, c.SendPasswordResetEmail, tc.request, tc.expectedResponse,
			)
		})
	}
}
