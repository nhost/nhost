package controller_test

import (
	"context"
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

func getSigninUser(userID uuid.UUID) sql.AuthUser {
	//nolint:exhaustruct
	return sql.AuthUser{
		ID: userID,
		CreatedAt: pgtype.Timestamptz{
			Time: time.Now(),
		},
		UpdatedAt:   pgtype.Timestamptz{},
		LastSeen:    pgtype.Timestamptz{},
		Disabled:    false,
		DisplayName: "Jane Doe",
		AvatarUrl:   "",
		Locale:      "en",
		Email:       sql.Text("jane@acme.com"),
		PhoneNumber: pgtype.Text{},
		PasswordHash: sql.Text(
			"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
		),
		EmailVerified:            true,
		PhoneNumberVerified:      false,
		NewEmail:                 pgtype.Text{},
		OtpMethodLastUsed:        pgtype.Text{},
		OtpHash:                  pgtype.Text{},
		OtpHashExpiresAt:         pgtype.Timestamptz{},
		DefaultRole:              "user",
		IsAnonymous:              false,
		TotpSecret:               pgtype.Text{},
		ActiveMfaType:            pgtype.Text{},
		Ticket:                   pgtype.Text{},
		TicketExpiresAt:          pgtype.Timestamptz{},
		Metadata:                 []byte("{}"),
		WebauthnCurrentChallenge: pgtype.Text{},
	}
}

//nolint:dupl
func TestPostSigninEmailPassword(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	cases := []testRequest[api.PostSigninEmailPasswordRequestObject, api.PostSigninEmailPasswordResponseObject]{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)

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
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: api.PostSigninEmailPassword200JSONResponse{
				Mfa: nil,
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
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
					},
				},
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
		},

		{
			name:   "with custom claims",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)

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
			customClaimer: func(ctrl *gomock.Controller) controller.CustomClaimer {
				mock := mock.NewMockCustomClaimer(ctrl)
				mock.EXPECT().GetClaims(
					gomock.Any(),
					"db477732-48fa-4289-b694-2886a646b6eb",
				).Return(map[string]any{
					"claim1":      "value1",
					"claim2":      "value2",
					"claimArray":  []any{"value1", "value2"},
					"claimObject": map[string]any{"key1": "value1", "key2": "value2"},
					"claimNil":    nil,
				}, nil)
				return mock
			},
			hibp:    mock.NewMockHIBPClient,
			emailer: mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: api.PostSigninEmailPassword200JSONResponse{
				Mfa: nil,
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
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
					},
				},
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
						"x-hasura-claim1":            "value1",
						"x-hasura-claim2":            "value2",
						"x-hasura-claimarray":        `{"value1","value2"}`,
						"x-hasura-claimnil":          "null",
						"x-hasura-claimobject":       `{"key1":"value1","key2":"value2"}`,
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
		},

		{
			name: "email not allowed",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedEmails = []string{"asd@asd.com"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)
				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "disabled user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "wrong password",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "wrongpassword",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "user not verified but verification disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

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
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: api.PostSigninEmailPassword200JSONResponse{
				Mfa: nil,
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
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            map[string]any{},
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
					},
				},
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
		},

		{
			name: "user not verified",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.RequireEmailVerification = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "wrongpassword",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "totp enabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.ActiveMfaType = sql.Text("totp")
				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("mfaTotp:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(5 * time.Minute)),
					}),
				).Return(userID, nil)

				return mock
			},
			customClaimer: nil,
			hibp:          mock.NewMockHIBPClient,
			emailer:       mock.NewMockEmailer,
			request: api.PostSigninEmailPasswordRequestObject{
				Body: &api.PostSigninEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
				},
			},
			expectedResponse: api.PostSigninEmailPassword200JSONResponse{
				Mfa: &api.MFAChallengePayload{
					Ticket: "mfaTotp:xxxx",
				},
				Session: nil,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: tc.customClaimer,
				emailer:       nil,
				hibp:          nil,
			})

			resp := assertRequest(
				context.Background(), t, c.PostSigninEmailPassword, tc.request, tc.expectedResponse,
			)

			resp200, ok := resp.(api.PostSigninEmailPassword200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
