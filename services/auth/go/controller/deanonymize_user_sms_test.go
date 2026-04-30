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

func TestDeanonymizeUserSMS(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

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
					"x-hasura-allowed-roles":     []any{"anonymous"},
					"x-hasura-default-role":      "anonymous",
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "true",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[
		api.DeanonymizeUserSMSRequestObject, api.DeanonymizeUserSMSResponseObject,
	]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymizeSMS(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeSMSParams{
						Roles:            []string{"user", "me"},
						PhoneNumber:      sql.Text("+1234567890"),
						Otp:              sql.Text("otp"),
						OtpHashExpiresAt: sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						DefaultRole:      sql.Text("user"),
						DisplayName:      sql.Text("+1234567890"),
						Locale:           sql.Text("en"),
						Metadata:         nil,
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(nil)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(), userID,
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: api.DeanonymizeUserSMS200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						gomock.Any(),
						"+1234567890",
						"en",
					).Return("otp", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "success with options",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().DeleteUserRoles(
					gomock.Any(), userID,
				).Return(nil)

				mock.EXPECT().UpdateUserDeanonymizeSMS(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserDeanonymizeSMSParams{
						Roles:            []string{"user"},
						PhoneNumber:      sql.Text("+1234567890"),
						Otp:              sql.Text("otp"),
						OtpHashExpiresAt: sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						DefaultRole:      sql.Text("user"),
						DisplayName:      sql.Text("Jane"),
						Locale:           sql.Text("en"),
						Metadata:         []byte(`{"key":"value"}`),
						ID: pgtype.UUID{
							Bytes: userID,
							Valid: true,
						},
					},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(nil)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(), userID,
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"user"},
						DefaultRole:  ptr("user"),
						DisplayName:  ptr("Jane"),
						Locale:       ptr("fr"),
						Metadata: &map[string]any{
							"key": "value",
						},
						RedirectTo: ptr("http://localhost:3000/redirect"),
					},
				},
			},
			expectedResponse: api.DeanonymizeUserSMS200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						gomock.Any(),
						"+1234567890",
						"en",
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
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
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

		{
			name:   "user not anonymous",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			jwtTokenFn: func() *jwt.Token {
				token := jwtTokenFn()
				m, _ := token.Claims.(jwt.MapClaims)
				claims, _ := m["https://hasura.io/jwt/claims"].(map[string]any)
				claims["x-hasura-user-is-anonymous"] = "false"

				return token
			},
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-not-anonymous",
				Message: "Logged in user is not anonymous",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "phone number already exists",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, nil) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
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

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
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
						gomock.Any(),
						"+1234567890",
						"en",
					).Return("", time.Time{}, errors.New("provider down")) //nolint:err113

					return mock
				}),
			},
		},

		{
			name:   "role not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			jwtTokenFn: jwtTokenFn,
			request: api.DeanonymizeUserSMSRequestObject{
				Body: &api.UserDeanonymizeSMSRequest{
					PhoneNumber: "+1234567890",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"admin"},
						DefaultRole:  nil,
						DisplayName:  nil,
						Locale:       nil,
						Metadata:     nil,
						RedirectTo:   nil,
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "role-not-allowed",
				Message: "Role not allowed",
				Status:  400,
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
				ctx, t, c.DeanonymizeUserSMS, tc.request, tc.expectedResponse,
			)
		})
	}
}
