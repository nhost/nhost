package controller_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestPostSigninAnonymous(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	insertResponse := sql.InsertUserWithRefreshTokenRow{
		ID:             userID,
		RefreshTokenID: refreshTokenID,
	}

	cases := []testRequest[api.PostSigninAnonymousRequestObject, api.PostSigninAnonymousResponseObject]{
		{
			name: "no body",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AnonymousUsersEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "Anonymous User",
						AvatarUrl:             "",
						Email:                 sql.Text(""),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "anonymous",
						Metadata:              []byte("null"),
						Roles:                 []string{"anonymous"},
						IsAnonymous:           true,
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.PostSigninAnonymousRequestObject{
				Body: nil,
			},
			expectedResponse: api.PostSigninAnonymous200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "anonymous",
						DisplayName:         "Anonymous User",
						Email:               nil,
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         true,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"anonymous"},
						ActiveMfaType:       nil,
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withHIBP(mock.NewMockHIBPClient),
				withEmailer(mock.NewMockEmailer),
			},
		},

		{
			name: "empty body",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AnonymousUsersEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "Anonymous User",
						AvatarUrl:             "",
						Email:                 sql.Text(""),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "anonymous",
						Metadata:              []byte("null"),
						Roles:                 []string{"anonymous"},
						IsAnonymous:           true,
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.PostSigninAnonymousRequestObject{
				Body: &api.PostSigninAnonymousJSONRequestBody{}, //nolint:exhaustruct
			},
			expectedResponse: api.PostSigninAnonymous200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "anonymous",
						DisplayName:         "Anonymous User",
						Email:               nil,
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         true,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"anonymous"},
						ActiveMfaType:       nil,
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withHIBP(mock.NewMockHIBPClient),
				withEmailer(mock.NewMockEmailer),
			},
		},

		{
			name: "with body",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AnonymousUsersEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "J. Doe",
						AvatarUrl:             "",
						Email:                 sql.Text(""),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "es",
						DefaultRole:           "anonymous",
						Metadata:              []byte(`{"key":"value","key2":"value2"}`),
						Roles:                 []string{"anonymous"},
						IsAnonymous:           true,
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.PostSigninAnonymousRequestObject{
				Body: &api.PostSigninAnonymousJSONRequestBody{
					DisplayName: ptr("J. Doe"),
					Locale:      ptr("es"),
					Metadata: &map[string]any{
						"key":  "value",
						"key2": "value2",
					},
				},
			},
			expectedResponse: api.PostSigninAnonymous200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:     "",
						CreatedAt:     time.Now(),
						DefaultRole:   "anonymous",
						DisplayName:   "J. Doe",
						Email:         nil,
						EmailVerified: false,
						Id:            "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:   true,
						Locale:        "es",
						Metadata: map[string]any{
							"key":  "value",
							"key2": "value2",
						},
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"anonymous"},
						ActiveMfaType:       nil,
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withHIBP(mock.NewMockHIBPClient),
				withEmailer(mock.NewMockEmailer),
			},
		},

		{ //nolint:dupl
			name: "signup disabled",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.DisableSignup = true
				cfg.AnonymousUsersEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostSigninAnonymousRequestObject{
				Body: &api.PostSigninAnonymousJSONRequestBody{}, //nolint:exhaustruct
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withHIBP(mock.NewMockHIBPClient),
				withEmailer(mock.NewMockEmailer),
			},
		},

		{ //nolint:dupl
			name: "anonymous users disabled",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.DisableSignup = false
				cfg.AnonymousUsersEnabled = false
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostSigninAnonymousRequestObject{
				Body: &api.PostSigninAnonymousJSONRequestBody{}, //nolint:exhaustruct
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
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
			},
			jwtTokenFn: nil,
			getControllerOpts: []getControllerOptsFunc{
				withHIBP(mock.NewMockHIBPClient),
				withEmailer(mock.NewMockEmailer),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp := assertRequest(
				t.Context(), t, c.PostSigninAnonymous, tc.request, tc.expectedResponse,
			)

			resp200, ok := resp.(api.PostSigninAnonymous200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
