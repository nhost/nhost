package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestVerifyElevateOTPEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
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

	verifyEmailOTPParams := sql.VerifyEmailOTPParams{
		Email:       sql.Text("jane@acme.com"),
		Otp:         sql.Text("123456"),
		MaxAttempts: pgtype.Int4{Int32: 5, Valid: true},
	}

	cases := []testRequest[api.VerifyElevateOTPEmailRequestObject, api.VerifyElevateOTPEmailResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().VerifyEmailOTP(
					gomock.Any(),
					verifyEmailOTPParams,
				).Return("ok", nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"},
					{UserID: userID, Role: "me"},
				}, nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{},
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
			expectedResponse: api.VerifyElevateOTPEmail200JSONResponse{
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
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
						ActiveMfaType:       nil,
					},
				},
			},
			jwtTokenFn: jwtTokenFn,
			// The elevated session carries the extra x-hasura-auth-elevated claim
			// that the input token above does not have.
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
						"x-hasura-auth-elevated":     "db477732-48fa-4289-b694-2886a646b6eb",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
			},
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
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
			name:   "no jwt token",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			// check inside GetUserFromJWTInContext, so no OTP can be verified.
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
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			name:   "invalid or expired otp",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				// Wrong code with attempts still left, or no live code for the
				// email: the query reports "invalid" and no session is created.
				mock.EXPECT().VerifyEmailOTP(
					gomock.Any(),
					verifyEmailOTPParams,
				).Return("invalid", nil)

				return mock
			},
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-otp",
				Message: "Invalid or expired OTP",
				Status:  400,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "too many attempts - otp burned",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				// Code was burned after too many wrong guesses: the query reports
				// "burned" so the user is told to request a new one.
				mock.EXPECT().VerifyEmailOTP(
					gomock.Any(),
					verifyEmailOTPParams,
				).Return("burned", nil)

				return mock
			},
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "otp-too-many-attempts",
				Message: "Too many incorrect attempts, please request a new OTP",
				Status:  400,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "verification query error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().VerifyEmailOTP(
					gomock.Any(),
					verifyEmailOTPParams,
				).Return("", errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
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
			name:   "session creation error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().VerifyEmailOTP(
					gomock.Any(),
					verifyEmailOTPParams,
				).Return("ok", nil)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return(nil, errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.VerifyElevateOTPEmailRequestObject{
				Body: &api.ElevateOTPEmailVerifyRequest{
					Otp: "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
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

			resp := assertRequest(
				ctx,
				t,
				c.VerifyElevateOTPEmail,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.VerifyElevateOTPEmail200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
