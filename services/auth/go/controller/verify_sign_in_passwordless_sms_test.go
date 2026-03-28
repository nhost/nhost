package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestVerifySignInPasswordlessSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.SMSPasswordlessEnabled = true

		return config
	}

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.VerifySignInPasswordlessSmsRequestObject, api.VerifySignInPasswordlessSmsResponseObject]{ //nolint:lll
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"}, //nolint:exhaustruct
					{UserID: userID, Role: "me"},   //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(refreshTokenID, nil)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(), userID,
				).Return(sql.TimestampTz(time.Now()), nil)

				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: api.VerifySignInPasswordlessSms200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            map[string]any{},
						PhoneNumber:         new("+1234567890"),
						PhoneNumberVerified: true,
						Roles:               []string{"user", "me"},
						ActiveMfaType:       nil,
					},
				},
				Mfa: nil,
			},
			expectedJWT: &jwt.Token{
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					user := getSigninUser(userID)
					user.PhoneNumber = sql.Text("+1234567890")
					user.PhoneNumberVerified = true

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(user, nil)

					return mock
				}),
			},
		},

		{
			name: "sms passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.SMSPasswordlessEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "invalid OTP",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "wrong",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"wrong",
					).Return(sql.AuthUser{}, errors.New("invalid OTP")) //nolint:err113,exhaustruct

					return mock
				}),
			},
		},

		{
			name:   "user is disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					user := getSigninUser(userID)
					user.PhoneNumber = sql.Text("+1234567890")
					user.PhoneNumberVerified = true
					user.Disabled = true

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(user, nil)

					return mock
				}),
			},
		},

		{
			name: "user email not verified",
			config: func() *controller.Config {
				config := getConfig()
				config.RequireEmailVerification = true

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					user := getSigninUser(userID)
					user.PhoneNumber = sql.Text("+1234567890")
					user.PhoneNumberVerified = true
					user.EmailVerified = false

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(user, nil)

					return mock
				}),
			},
		},

		{
			name:   "session creation error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return(nil, errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					user := getSigninUser(userID)
					user.PhoneNumber = sql.Text("+1234567890")
					user.PhoneNumberVerified = true

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(user, nil)

					return mock
				}),
			},
		},

		{
			name:   "user with no email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"}, //nolint:exhaustruct
					{UserID: userID, Role: "me"},   //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(refreshTokenID, nil)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(), userID,
				).Return(sql.TimestampTz(time.Now()), nil)

				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: api.VerifySignInPasswordlessSms200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               nil,
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            map[string]any{},
						PhoneNumber:         new("+1234567890"),
						PhoneNumberVerified: true,
						Roles:               []string{"user", "me"},
						ActiveMfaType:       nil,
					},
				},
				Mfa: nil,
			},
			expectedJWT: &jwt.Token{
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					user := getSigninUser(userID)
					user.PhoneNumber = sql.Text("+1234567890")
					user.PhoneNumberVerified = true
					user.Email = pgtype.Text{} //nolint:exhaustruct
					user.EmailVerified = false

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(user, nil)

					return mock
				}),
			},
		},

		{
			name:   "empty phone number",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"",
						"123456",
					).Return(sql.AuthUser{}, errors.New("invalid phone number")) //nolint:err113,exhaustruct

					return mock
				}),
			},
		},

		{
			name:   "empty OTP",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"",
					).Return(sql.AuthUser{}, errors.New("empty OTP")) //nolint:err113,exhaustruct

					return mock
				}),
			},
		},

		{
			name:   "sms service error during verification",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.VerifySignInPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsOtpRequest{
					PhoneNumber: "+1234567890",
					Otp:         "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().CheckVerificationCode(
						gomock.Any(),
						"+1234567890",
						"123456",
					).Return(sql.AuthUser{}, errors.New("SMS service unavailable")) //nolint:err113,exhaustruct

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

			resp := assertRequest(
				t.Context(),
				t,
				c.VerifySignInPasswordlessSms,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.VerifySignInPasswordlessSms200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
