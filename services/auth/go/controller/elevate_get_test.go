package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestGetElevationMethods(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

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

	totpUser := sql.AuthUser{
		ID:            userID,
		ActiveMfaType: sql.Text("totp"),
		TotpSecret:    sql.Text("encrypted-secret"),
	}
	plainUser := sql.AuthUser{ID: userID}
	emailUser := sql.AuthUser{ID: userID, Email: sql.Text("jane@acme.com")}
	smsUser := sql.AuthUser{
		ID:                  userID,
		PhoneNumber:         sql.Text("+1234567890"),
		PhoneNumberVerified: true,
	}

	cases := []testRequest[
		api.GetElevationMethodsRequestObject,
		api.GetElevationMethodsResponseObject,
	]{
		{
			name:   "both factors available",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(totpUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods: []api.ElevationMethod{
					api.ElevationMethodWebauthn,
					api.ElevationMethodTotp,
				},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "security key only",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(plainUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodWebauthn},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "totp only",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(totpUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodTotp},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "no factor set up",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(plainUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name: "webauthn disabled, stale security keys",
			config: func() *controller.Config {
				c := getConfig()
				c.WebauthnEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// Security keys are not even counted when WebAuthn is off.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(gomock.Any(), userID).Return(totpUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodTotp},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name: "totp disabled, stale active_mfa_type",
			config: func() *controller.Config {
				c := getConfig()
				c.TOTPEnabled = false
				c.OTPEmailEnabled = false
				c.OTPSmsEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// The user row is not read when no user-row-backed factor
				// (TOTP, email OTP, SMS OTP) is on.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(1), nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodWebauthn},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "email otp only",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(emailUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodOtpEmail},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name: "email otp disabled, user with an email",
			config: func() *controller.Config {
				c := getConfig()
				c.OTPEmailEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// /elevate/otp/email is a disabled endpoint, so the address is
				// not a factor the user can elevate with.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(emailUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "sms otp only",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(smsUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{api.ElevationMethodOtpSms},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "unverified phone number is not a factor",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// A number nobody has proved control of cannot prove identity,
				// so it must not be advertised as a way to elevate.
				mock := mock.NewMockDBClient(ctrl)

				user := smsUser
				user.PhoneNumberVerified = false

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name: "sms otp disabled, user with a verified phone number",
			config: func() *controller.Config {
				c := getConfig()
				c.OTPSmsEnabled = false

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// SMS passwordless sign-in stays on in getConfig; only the OTP
				// SMS capability is off, so the phone number is not a factor
				// the user can elevate with.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(smsUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "elevation disabled still reports what the user could elevate with",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// /elevate/totp works regardless of the mode, so the factor is
				// genuinely available even though nothing demands it.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(totpUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{api.ElevationMethodTotp},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("disabled"),
			},
		},

		{
			name:   "elevation required but no factor set up yet",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(plainUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("required"),
			},
		},

		{
			name:   "totp active but no secret is not a usable factor",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				// ElevateTotp refuses this user with no-totp-secret, so
				// advertising TOTP would demand an impossible elevation.
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{
					ID:            userID,
					ActiveMfaType: sql.Text("totp"),
				}, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: false,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
			},
		},

		{
			name:   "unset mode fails closed, like the middleware",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(int64(0), nil)
				mock.EXPECT().GetUser(gomock.Any(), userID).Return(plainUser, nil)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: api.GetElevationMethods200JSONResponse{
				ElevationRequired: true,
				Methods:           []api.ElevationMethod{},
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "database error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().CountSecurityKeysUser(gomock.Any(), userID).Return(
					int64(0), errors.New("database error"), //nolint:err113
				)

				return mock
			},
			request: api.GetElevationMethodsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withElevationMode("recommended"),
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
				c.GetElevationMethods,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
