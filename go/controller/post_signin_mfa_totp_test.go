package controller_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func fakeNow(t time.Time) func() time.Time {
	return func() time.Time {
		return t
	}
}

func getUserSigninMfaTotp(userID uuid.UUID) sql.AuthUser {
	//nolint:exhaustruct
	return sql.AuthUser{
		ID: userID,
		CreatedAt: pgtype.Timestamptz{
			Time: time.Now(),
		},
		Disabled:    false,
		DisplayName: "Jane Doe",
		DefaultRole: "user",
		Metadata:    []byte("{}"),
		AvatarUrl:   "",
		Locale:      "en",
		Email:       sql.Text("jane@acme.com"),
		PasswordHash: sql.Text(
			"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
		),
		EmailVerified: true,
		TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
		ActiveMfaType: sql.Text("totp"),
	}
}

func TestPostSigninMfaTotp(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.PostSigninMfaTotpRequestObject, api.PostSigninMfaTotpResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(
					getUserSigninMfaTotp(userID),
					nil,
				)

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
			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "373186",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: api.PostSigninMfaTotp200JSONResponse{
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
			jwtTokenFn: nil,
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
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "wrong totp",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(
					getUserSigninMfaTotp(userID),
					nil,
				)

				return mock
			},
			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "123456",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-totp",
				Message: "Invalid TOTP code",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name: "mfa disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.MfaEnabled = false
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "123456",
					Ticket: "mfaTotp:123456",
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
			name:   "user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},

			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "123456",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-ticket",
				Message: "Invalid ticket",
				Status:  401,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getUserSigninMfaTotp(userID)
				user.Disabled = true

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(user, nil)

				return mock
			},

			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "373186",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "mfa other than totp method",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getUserSigninMfaTotp(userID)
				user.ActiveMfaType = sql.Text("sms")

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(user, nil)

				return mock
			},

			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "373186",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-mfa-totp",
				Message: "User does not have TOTP MFA enabled",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "mfa secret missing",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getUserSigninMfaTotp(userID)
				user.TotpSecret = sql.Text("")

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("mfaTotp:123456"),
				).Return(user, nil)

				return mock
			},

			request: api.PostSigninMfaTotpRequestObject{
				Body: &api.PostSigninMfaTotpJSONRequestBody{
					Otp:    "373186",
					Ticket: "mfaTotp:123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "no-totp-secret",
				Message: "User does not have a TOTP secret",
				Status:  400,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
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
				c.PostSigninMfaTotp,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
