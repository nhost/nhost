package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

// getSigninUser with a phone number attached.
func getSigninUserWithPhone(userID uuid.UUID) sql.AuthUser {
	user := getSigninUser(userID)
	user.PhoneNumber = sql.Text("+441234567890")

	return user
}

func TestElevateOTPSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	otpExpiresAt := time.Now().Add(5 * time.Minute)

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

	otpSMS := func(ctrl *gomock.Controller) *mock.MockSMSer {
		mock := mock.NewMockSMSer(ctrl)

		mock.EXPECT().SendVerificationCode(
			gomock.Any(),
			"+441234567890",
			"en",
		).Return("123456", otpExpiresAt, nil)

		return mock
	}

	cases := []testRequest[api.ElevateOTPSmsRequestObject, api.ElevateOTPSmsResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUserWithPhone(userID), nil)

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					cmpDBParams(
						sql.UpdateUserOTPHashParams{
							ID:                userID,
							Otp:               "123456",
							OtpHashExpiresAt:  sql.TimestampTz(otpExpiresAt),
							OtpMethodLastUsed: sql.Text("sms"),
						},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(userID, nil)

				return mock
			},
			request:          api.ElevateOTPSmsRequestObject{},
			expectedResponse: api.ElevateOTPSms200JSONResponse(api.OK),
			jwtTokenFn:       jwtTokenFn,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(otpSMS),
			},
		},

		{
			name: "sms passwordless disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.SMSPasswordlessEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.ElevateOTPSmsRequestObject{},
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
			request: api.ElevateOTPSmsRequestObject{},
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
			request: api.ElevateOTPSmsRequestObject{},
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

				user := getSigninUserWithPhone(userID)
				user.Disabled = true

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(user, nil)

				return mock
			},
			request: api.ElevateOTPSmsRequestObject{},
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
			name:   "user has no phone number",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.PhoneNumber = pgtype.Text{}

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(user, nil)

				return mock
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "sms send failure",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUserWithPhone(userID), nil)

				return mock
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "cannot-send-sms",
				Message: "Cannot send SMS, check your phone number is correct",
				Status:  400,
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						gomock.Any(),
						"+441234567890",
						"en",
					).Return("", time.Time{}, errors.New("twilio error")) //nolint:err113

					return mock
				}),
			},
		},

		{
			name:   "otp hash update error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUserWithPhone(userID), nil)

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					gomock.Any(),
				).Return(uuid.UUID{}, errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(otpSMS),
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
				c.ElevateOTPSms,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
