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
	"go.uber.org/mock/gomock"
)

const smsElevationPhone = "+1234567890"

func smsElevationConfig() *controller.Config {
	config := getConfig()
	config.SMSPasswordlessEnabled = true

	return config
}

func smsElevationJWT(userID uuid.UUID) *jwt.Token {
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

func smsElevationUser(userID uuid.UUID) sql.AuthUser {
	user := getSigninUser(userID)
	user.PhoneNumber = sql.Text(smsElevationPhone)
	user.PhoneNumberVerified = true

	return user
}

func smsWithoutExpectations(ctrl *gomock.Controller) *mock.MockSMSer {
	return mock.NewMockSMSer(ctrl)
}

func TestElevateOTPSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	expiresAt := time.Date(2026, time.August, 19, 12, 5, 0, 0, time.UTC)
	jwtTokenFn := func() *jwt.Token { return smsElevationJWT(userID) }

	// getController wires withSMS before db, so this expectation is initialized before db uses it.
	var orderedSend *gomock.Call

	baseCases := []testRequest[api.ElevateOTPSmsRequestObject, api.ElevateOTPSmsResponseObject]{
		{
			name:   "success sends before storing the challenge",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
				db.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					sql.UpdateUserOTPHashParams{
						ID:                userID,
						Otp:               "654321",
						OtpHashExpiresAt:  sql.TimestampTz(expiresAt),
						OtpMethodLastUsed: sql.Text("sms"),
					},
				).After(orderedSend).Return(userID, nil)

				return db
			},
			request:          api.ElevateOTPSmsRequestObject{},
			expectedResponse: api.ElevateOTPSms200JSONResponse(api.OK),
			jwtTokenFn:       jwtTokenFn,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					sms := mock.NewMockSMSer(ctrl)
					orderedSend = sms.EXPECT().SendVerificationCode(
						gomock.Any(), smsElevationPhone, "en",
					).Return("654321", expiresAt, nil)

					return sms
				}),
			},
		},
		{
			name: "sms passwordless disabled",
			config: func() *controller.Config {
				config := smsElevationConfig()
				config.SMSPasswordlessEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-endpoint", Message: "This endpoint is disabled", Status: 409,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "no jwt token",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error: "invalid-request", Message: "The request payload is incorrect", Status: 400,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "user not found",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(sql.AuthUser{}, pgx.ErrNoRows)

				return db
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error: "invalid-email-password", Message: "Incorrect email or password", Status: 401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "disabled user",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				user := smsElevationUser(userID)
				user.Disabled = true
				db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

				return db
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "sms provider failure does not store a challenge",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)

				return db
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
					sms := mock.NewMockSMSer(ctrl)
					sms.EXPECT().SendVerificationCode(
						gomock.Any(), smsElevationPhone, "en",
					).Return("", time.Time{}, errors.New("provider unavailable")) //nolint:err113

					return sms
				}),
			},
		},
		{
			name:   "challenge storage failure",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
				db.EXPECT().UpdateUserOTPHash(
					gomock.Any(), gomock.Any(),
				).Return(uuid.Nil, errors.New("database unavailable")) //nolint:err113

				return db
			},
			request: api.ElevateOTPSmsRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error: "internal-server-error", Message: "Internal server error", Status: 500,
			},
			jwtTokenFn:  jwtTokenFn,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					sms := mock.NewMockSMSer(ctrl)
					sms.EXPECT().SendVerificationCode(
						gomock.Any(), smsElevationPhone, "en",
					).Return("654321", expiresAt, nil)

					return sms
				}),
			},
		},
		{
			name:   "phone-only user",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				user := smsElevationUser(userID)
				user.Email = pgtype.Text{}
				db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				db.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					sql.UpdateUserOTPHashParams{
						ID:                userID,
						Otp:               "654321",
						OtpHashExpiresAt:  sql.TimestampTz(expiresAt),
						OtpMethodLastUsed: sql.Text("sms"),
					},
				).Return(userID, nil)

				return db
			},
			request:          api.ElevateOTPSmsRequestObject{},
			expectedResponse: api.ElevateOTPSms200JSONResponse(api.OK),
			jwtTokenFn:       jwtTokenFn,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					sms := mock.NewMockSMSer(ctrl)
					sms.EXPECT().SendVerificationCode(
						gomock.Any(), smsElevationPhone, "en",
					).Return("654321", expiresAt, nil)

					return sms
				}),
			},
		},
	}

	factorCases := []struct {
		name   string
		mutate func(*sql.AuthUser)
	}{
		{
			name:   "missing phone",
			mutate: func(user *sql.AuthUser) { user.PhoneNumber = pgtype.Text{} },
		},
		{name: "empty phone", mutate: func(user *sql.AuthUser) { user.PhoneNumber = sql.Text("") }},
		{
			name:   "unverified phone",
			mutate: func(user *sql.AuthUser) { user.PhoneNumberVerified = false },
		},
	}
	cases := make(
		[]testRequest[api.ElevateOTPSmsRequestObject, api.ElevateOTPSmsResponseObject],
		0,
		len(baseCases)+len(factorCases),
	)

	cases = append(cases, baseCases...)
	for _, factorCase := range factorCases {
		cases = append(
			cases,
			testRequest[api.ElevateOTPSmsRequestObject, api.ElevateOTPSmsResponseObject]{
				name:   factorCase.name,
				config: smsElevationConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					db := mock.NewMockDBClient(ctrl)
					user := smsElevationUser(userID)
					factorCase.mutate(&user)
					db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

					return db
				},
				request: api.ElevateOTPSmsRequestObject{},
				expectedResponse: controller.ErrorResponse{
					Error: "disabled-endpoint", Message: "This endpoint is disabled", Status: 409,
				},
				jwtTokenFn:  jwtTokenFn,
				expectedJWT: nil,
				getControllerOpts: []getControllerOptsFunc{
					withSMS(smsWithoutExpectations),
				},
			},
		)
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

			assertRequest(ctx, t, c.ElevateOTPSms, tc.request, tc.expectedResponse)
		})
	}
}
