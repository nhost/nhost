package controller_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
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

func TestSignUpOTPEmail(t *testing.T) {
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.OTPEmailEnabled = true

		return config
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.SignUpOTPEmailRequestObject, api.SignUpOTPEmailResponseObject]{
		{ //nolint:dupl
			name:   "success - new user signup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				// Check user does not exist
				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "jane@acme.com",
						AvatarUrl:         "",
						Email:             sql.Text("jane@acme.com"),
						PasswordHash:      pgtype.Text{}, //nolint:exhaustruct
						Ticket:            sql.Text("xxx"),
						TicketExpiresAt:   sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:     false,
						Locale:            "en",
						DefaultRole:       "user",
						Metadata:          []byte("null"),
						Roles:             []string{"user", "me"},
						PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
						Otp:               "",
						OtpHashExpiresAt:  pgtype.Timestamptz{}, //nolint:exhaustruct
						OtpMethodLastUsed: pgtype.Text{},        //nolint:exhaustruct
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.SignUpOTPEmailRequestObject{
				Body: &api.SignUpOTPEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.SignUpOTPEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
						"jane@acme.com",
						"en",
						notifications.TemplateNameSigninOTP,
						testhelpers.GomockCmpOpts(
							notifications.TemplateData{
								Link:        "",
								DisplayName: "jane@acme.com",
								Email:       "jane@acme.com",
								NewEmail:    "",
								Ticket:      "xxx",
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
			name: "error - otp disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.OTPEmailEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpOTPEmailRequestObject{
				Body: &api.SignUpOTPEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "error - signup disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.DisableSignup = true

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpOTPEmailRequestObject{
				Body: &api.SignUpOTPEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			// Signup returns the same 200 OK whether the user exists or not
			// so that the endpoint cannot be used to enumerate accounts.
			name:   "user already exists - returns OK without sending OTP",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: true,
				}, nil)

				return mock
			},
			request: api.SignUpOTPEmailRequestObject{
				Body: &api.SignUpOTPEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SignUpOTPEmail200JSONResponse(api.OK),
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user already exists but unverified - returns OK without sending OTP",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
				}, nil)

				return mock
			},
			request: api.SignUpOTPEmailRequestObject{
				Body: &api.SignUpOTPEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse:  api.SignUpOTPEmail200JSONResponse(api.OK),
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
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
				c.SignUpOTPEmail,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
