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

func smsElevationVerifyParams(otp string) sql.VerifySMSOTPParams {
	return sql.VerifySMSOTPParams{
		MaxAttempts: pgtype.Int4{Int32: 5, Valid: true},
		Otp:         sql.Text(otp),
		PhoneNumber: sql.Text(smsElevationPhone),
	}
}

func expectSMSElevationSession(
	db *mock.MockDBClient,
	userID uuid.UUID,
	refreshTokenID uuid.UUID,
) {
	db.EXPECT().GetUserRoles(gomock.Any(), userID).Return([]sql.AuthUserRole{
		{UserID: userID, Role: "user"},
		{UserID: userID, Role: "me"},
	}, nil)
	db.EXPECT().InsertRefreshtoken(
		gomock.Any(),
		cmpDBParams(sql.InsertRefreshtokenParams{
			UserID:           userID,
			RefreshTokenHash: pgtype.Text{},
			ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
			Type:             sql.RefreshTokenTypeRegular,
			Metadata:         nil,
		}),
	).Return(refreshTokenID, nil)
	db.EXPECT().UpdateUserLastSeen(
		gomock.Any(), userID,
	).Return(sql.TimestampTz(time.Now()), nil)
}

func expectedSMSElevationResponse(
	userID uuid.UUID,
	refreshTokenID uuid.UUID,
	email *types.Email,
) api.VerifyElevateOTPSms200JSONResponse {
	return api.VerifyElevateOTPSms200JSONResponse{
		Session: &api.Session{
			AccessToken:          "",
			AccessTokenExpiresIn: 900,
			RefreshTokenId:       refreshTokenID.String(),
			RefreshToken:         "",
			User: &api.User{
				AvatarUrl:           "",
				CreatedAt:           time.Now(),
				DefaultRole:         "user",
				DisplayName:         "Jane Doe",
				Email:               email,
				EmailVerified:       true,
				Id:                  userID.String(),
				IsAnonymous:         false,
				Locale:              "en",
				Metadata:            map[string]any{},
				PhoneNumber:         new(smsElevationPhone),
				PhoneNumberVerified: true,
				Roles:               []string{"user", "me"},
				ActiveMfaType:       nil,
			},
		},
	}
}

func expectedSMSElevatedJWT(t *testing.T, userID uuid.UUID) *jwt.Token {
	t.Helper()

	token := smsElevationJWT(userID)

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("expected JWT map claims")
	}

	hasuraClaims, ok := claims["https://hasura.io/jwt/claims"].(map[string]any)
	if !ok {
		t.Fatal("expected Hasura JWT claims")
	}

	hasuraClaims["x-hasura-auth-elevated"] = userID.String()

	return token
}

func TestVerifyElevateOTPSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	foreignUserID := uuid.MustParse("9142CB57-C25A-4A7B-8487-A138ABB76F8E")
	jwtTokenFn := func() *jwt.Token { return smsElevationJWT(userID) }
	request := func(otp string) api.VerifyElevateOTPSmsRequestObject {
		return api.VerifyElevateOTPSmsRequestObject{
			Body: &api.ElevateOTPSmsVerifyRequest{Otp: otp},
		}
	}

	cases := []testRequest[api.VerifyElevateOTPSmsRequestObject, api.VerifyElevateOTPSmsResponseObject]{
		{
			name:   "success mints a session bound to the jwt user",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				user := smsElevationUser(userID)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(user, nil)
				expectSMSElevationSession(db, userID, refreshTokenID)

				return db
			},
			request: request("123456"),
			expectedResponse: expectedSMSElevationResponse(
				userID,
				refreshTokenID,
				ptr(types.Email("jane@acme.com")),
			),
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       expectedSMSElevatedJWT(t, userID),
			getControllerOpts: []getControllerOptsFunc{},
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
			request: request("123456"),
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-endpoint", Message: "This endpoint is disabled", Status: 409,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "verification database error",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(sql.AuthUser{}, errors.New("database unavailable")) //nolint:err113

				return db
			},
			request: request("123456"),
			expectedResponse: controller.ErrorResponse{
				Error: "internal-server-error", Message: "Internal server error", Status: 500,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "verification cannot cross user boundaries",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(smsElevationUser(foreignUserID), nil)

				return db
			},
			request: request("123456"),
			expectedResponse: controller.ErrorResponse{
				Error: "invalid-otp", Message: "Invalid or expired OTP", Status: 400,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "returned user fails validation",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
				freshUser := smsElevationUser(userID)
				freshUser.Disabled = true
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(freshUser, nil)

				return db
			},
			request: request("123456"),
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "session creation failure",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				user := smsElevationUser(userID)
				db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(user, nil)
				db.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return(nil, errors.New("database unavailable")) //nolint:err113

				return db
			},
			request: request("123456"),
			expectedResponse: controller.ErrorResponse{
				Error: "internal-server-error", Message: "Internal server error", Status: 500,
			},
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "phone-only user",
			config: smsElevationConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				db := mock.NewMockDBClient(ctrl)
				user := smsElevationUser(userID)
				user.Email = pgtype.Text{}
				db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)
				db.EXPECT().VerifySMSOTP(
					gomock.Any(), smsElevationVerifyParams("123456"),
				).Return(user, nil)
				expectSMSElevationSession(db, userID, refreshTokenID)

				return db
			},
			request:           request("123456"),
			expectedResponse:  expectedSMSElevationResponse(userID, refreshTokenID, nil),
			jwtTokenFn:        jwtTokenFn,
			expectedJWT:       expectedSMSElevatedJWT(t, userID),
			getControllerOpts: []getControllerOptsFunc{},
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
	for _, factorCase := range factorCases {
		cases = append(
			cases,
			testRequest[api.VerifyElevateOTPSmsRequestObject, api.VerifyElevateOTPSmsResponseObject]{
				name:   factorCase.name,
				config: smsElevationConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					db := mock.NewMockDBClient(ctrl)
					user := smsElevationUser(userID)
					factorCase.mutate(&user)
					db.EXPECT().GetUser(gomock.Any(), userID).Return(user, nil)

					return db
				},
				request: request("123456"),
				expectedResponse: controller.ErrorResponse{
					Error: "invalid-request", Message: "The request payload is incorrect", Status: 400,
				},
				jwtTokenFn:        jwtTokenFn,
				expectedJWT:       nil,
				getControllerOpts: []getControllerOptsFunc{},
			},
		)
	}

	invalidOTPCases := []struct {
		name string
		otp  string
	}{
		{name: "invalid otp", otp: "000000"},
		{name: "expired otp", otp: "123456"},
		{name: "burned otp", otp: "123456"},
		{name: "empty otp", otp: ""},
	}
	for _, otpCase := range invalidOTPCases {
		cases = append(
			cases,
			testRequest[api.VerifyElevateOTPSmsRequestObject, api.VerifyElevateOTPSmsResponseObject]{
				name:   otpCase.name,
				config: smsElevationConfig,
				db: func(ctrl *gomock.Controller) controller.DBClient {
					db := mock.NewMockDBClient(ctrl)
					db.EXPECT().GetUser(gomock.Any(), userID).Return(smsElevationUser(userID), nil)
					db.EXPECT().VerifySMSOTP(
						gomock.Any(), smsElevationVerifyParams(otpCase.otp),
					).Return(sql.AuthUser{}, pgx.ErrNoRows)

					return db
				},
				request: request(otpCase.otp),
				expectedResponse: controller.ErrorResponse{
					Error: "invalid-otp", Message: "Invalid or expired OTP", Status: 400,
				},
				jwtTokenFn:        jwtTokenFn,
				expectedJWT:       nil,
				getControllerOpts: []getControllerOptsFunc{},
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

			response := assertRequest(
				ctx, t, c.VerifyElevateOTPSms, tc.request, tc.expectedResponse,
			)
			if response200, ok := response.(api.VerifyElevateOTPSms200JSONResponse); ok {
				assertSession(t, jwtGetter, response200.Session, tc.expectedJWT)
			}
		})
	}
}
