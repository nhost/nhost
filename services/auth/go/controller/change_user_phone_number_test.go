package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func nonAnonymousJWT(userID uuid.UUID) *jwt.Token {
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

func TestChangeUserPhoneNumber(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	cases := []testRequest[
		api.ChangeUserPhoneNumberRequestObject, api.ChangeUserPhoneNumberResponseObject,
	]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByPhoneNumberOrNew(
					gomock.Any(),
					sql.GetUserByPhoneNumberOrNewParams{
						UserID:      userID,
						PhoneNumber: sql.Text("+1234567890"),
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().UpdateUserChangePhoneNumber(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserChangePhoneNumberParams{
						ID:               userID,
						NewPhoneNumber:   sql.Text("+1234567890"),
						Otp:              "otp",
						OtpHashExpiresAt: sql.TimestampTz(time.Now().Add(time.Minute * 5)),
					},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.ChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeRequest{
					NewPhoneNumber: "+1234567890",
				},
			},
			expectedResponse: api.ChangeUserPhoneNumber200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)
					mock.EXPECT().SendVerificationCode(
						gomock.Any(), "+1234567890", "en",
					).Return("otp", time.Now().Add(time.Minute*5), nil)

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
				return mock.NewMockDBClient(ctrl)
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.ChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeRequest{NewPhoneNumber: "+1234567890"},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "phone already exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByPhoneNumberOrNew(
					gomock.Any(),
					sql.GetUserByPhoneNumberOrNewParams{
						UserID:      userID,
						PhoneNumber: sql.Text("+1234567890"),
					},
				).Return(sql.AuthUser{}, nil) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.ChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeRequest{NewPhoneNumber: "+1234567890"},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "sms send failure",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserByPhoneNumberOrNew(
					gomock.Any(),
					sql.GetUserByPhoneNumberOrNewParams{
						UserID:      userID,
						PhoneNumber: sql.Text("+1234567890"),
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.ChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeRequest{NewPhoneNumber: "+1234567890"},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "cannot-send-sms",
				Message: "Cannot send SMS, check your phone number is correct",
				Status:  400,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)
					mock.EXPECT().SendVerificationCode(
						gomock.Any(), "+1234567890", "en",
					).Return("", time.Time{}, errors.New("provider down")) //nolint:err113

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

			ctx := jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			assertRequest(
				ctx, t, c.ChangeUserPhoneNumber, tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestVerifyChangeUserPhoneNumber(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	cases := []testRequest[
		api.VerifyChangeUserPhoneNumberRequestObject,
		api.VerifyChangeUserPhoneNumberResponseObject,
	]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().UpdateUserConfirmChangePhoneNumber(
					gomock.Any(),
					sql.UpdateUserConfirmChangePhoneNumberParams{
						ID:             userID,
						NewPhoneNumber: sql.Text("+1234567890"),
						Otp:            "123456",
					},
				).Return(getSigninUser(userID), nil)

				return mock
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.VerifyChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeVerifyRequest{
					NewPhoneNumber: "+1234567890",
					Otp:            "123456",
				},
			},
			expectedResponse:  api.VerifyChangeUserPhoneNumber200JSONResponse(api.OK),
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "invalid otp",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().UpdateUserConfirmChangePhoneNumber(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.VerifyChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeVerifyRequest{
					NewPhoneNumber: "+1234567890",
					Otp:            "wrong",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "sms passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.SMSPasswordlessEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			jwtTokenFn: func() *jwt.Token { return nonAnonymousJWT(userID) },
			request: api.VerifyChangeUserPhoneNumberRequestObject{
				Body: &api.UserPhoneNumberChangeVerifyRequest{
					NewPhoneNumber: "+1234567890",
					Otp:            "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			assertRequest(
				ctx, t, c.VerifyChangeUserPhoneNumber, tc.request, tc.expectedResponse,
			)
		})
	}
}
