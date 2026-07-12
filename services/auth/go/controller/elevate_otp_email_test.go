package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

func TestElevateOTPEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	// The endpoint reads the user from the JWT in context, so every case that
	// gets past the disabled-endpoint check needs a (non-elevated) token here.
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
					"x-hasura-user-id":           userID.String(),
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": userID.String(),
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	otpEmailer := func(ctrl *gomock.Controller) *mock.MockEmailer {
		mock := mock.NewMockEmailer(ctrl)

		mock.EXPECT().SendEmail(
			gomock.Any(),
			"jane@acme.com",
			"en",
			notifications.TemplateNameSigninOTP,
			testhelpers.GomockCmpOpts(
				notifications.TemplateData{
					Link:        "",
					DisplayName: "Jane Doe",
					Email:       "jane@acme.com",
					NewEmail:    "",
					Ticket:      "xxx",
					RedirectTo:  "http://localhost:3000",
					Locale:      "en",
					ServerURL:   "https://local.auth.nhost.run",
					ClientURL:   "http://localhost:3000",
				},
				testhelpers.FilterPathLast(
					[]string{".Ticket"}, cmp.Comparer(cmpTicket),
				),

				testhelpers.FilterPathLast(
					[]string{".Link"}, cmp.Comparer(cmpLink),
				),
			),
		).Return(nil)

		return mock
	}

	cases := []testRequest[api.ElevateOTPEmailRequestObject, api.ElevateOTPEmailResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					cmpDBParams(
						sql.UpdateUserOTPHashParams{
							ID:  userID,
							Otp: "xxx",
							OtpHashExpiresAt: sql.TimestampTz(
								time.Now().Add(controller.In10Minutes),
							),
							OtpMethodLastUsed: sql.Text("email"),
						},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(userID, nil)

				return mock
			},
			request:          api.ElevateOTPEmailRequestObject{},
			expectedResponse: api.ElevateOTPEmail200JSONResponse(api.OK),
			jwtTokenFn:       jwtTokenFn,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(otpEmailer),
			},
		},

		{
			name: "otp email disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.OTPEmailEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.ElevateOTPEmailRequestObject{},
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
			name:   "no jwt token",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(user, nil)

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "user unverified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(user, nil)

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			// A user without an email address fails the email access-control
			// check inside GetUserFromJWTInContext, so no OTP can be requested.
			name:   "user has no email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Email = pgtype.Text{}

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(user, nil)

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "otp hash update error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					gomock.Any(),
				).Return(uuid.UUID{}, errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "emailer failure",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					gomock.Any(),
				).Return(userID, nil)

				return mock
			},
			request: api.ElevateOTPEmailRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
						"jane@acme.com",
						"en",
						notifications.TemplateNameSigninOTP,
						gomock.Any(),
					).Return(errors.New("smtp error")) //nolint:err113

					return mock
				}),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(ctx, tc.jwtTokenFn())
			}

			assertRequest(
				ctx,
				t,
				c.ElevateOTPEmail,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
