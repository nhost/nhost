package controller_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestPostSignupEmailPassword(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	insertResponse := sql.InsertUserWithRefreshTokenRow{
		UserID:         userID,
		RefreshTokenID: refreshTokenID,
	}

	cases := []testRequest[api.PostSignupEmailPasswordRequestObject, api.PostSignupEmailPasswordResponseObject]{
		{
			name:   "simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "jane@acme.com",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
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
			name:   "simple with options",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "Jane Doe",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "se",
						DefaultRole:           "me",
						Metadata:              []byte(`{"firstName":"Jane","lastName":"Doe"}`),
						Roles:                 []string{"me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"me"},
						DefaultRole:  ptr("me"),
						DisplayName:  ptr("Jane Doe"),
						Locale:       ptr("se"),
						Metadata: &map[string]any{
							"firstName": "Jane",
							"lastName":  "Doe",
						},
						RedirectTo: ptr("http://localhost:3000"),
					},
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "me",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "se",
						Metadata:            map[string]any{"firstName": "Jane", "lastName": "Doe"},
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"me"},
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
						"x-hasura-allowed-roles":     []any{"me"},
						"x-hasura-default-role":      "me",
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

		{ //nolint:dupl
			name: "signup disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableSignup = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "disable new users",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableNewUsers = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        true,
						DisplayName:     "jane@acme.com",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("verifyEmail:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct

					),
				).Return(sql.InsertUserRow{
					UserID:    uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB"),
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "disable new users with email verify",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableNewUsers = true
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        true,
						DisplayName:     "jane@acme.com",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("verifyEmail:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB"),
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name:   "user duplicated",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(
					sql.InsertUserWithRefreshTokenRow{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "users_email_key" (SQLSTATE 23505)`), //nolint:goerr113,lll
				)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "email-already-in-use",
				Message: "Email already in use",
				Status:  409,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "user duplicated - sensitive option",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.ConcealErrors = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(
					sql.InsertUserWithRefreshTokenRow{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "users_email_key" (SQLSTATE 23505)`), //nolint:goerr113,lll
				)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{ //nolint:dupl
			name: "short password",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.ConcealErrors = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "p",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "password-too-short",
				Message: "Password is too short",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "hibp fail",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.PasswordHIBPEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)

				mock.EXPECT().IsPasswordPwned(
					gomock.Any(),
					"password",
				).Return(true, nil)

				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "password-in-hibp-database",
				Message: "Password is in HIBP database",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "hibp success",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.PasswordHIBPEnabled = true
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)

				mock.EXPECT().IsPasswordPwned(
					gomock.Any(),
					"password",
				).Return(false, nil)

				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "jane@acme.com",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
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
			name:   "wrong roles",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"admin", "user"},
						DefaultRole:  ptr("user"),
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
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "simple with gravatar",
			config: func() *controller.Config {
				c := getConfig()
				c.GravatarEnabled = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "https://www.gravatar.com/avatar/a6b55dc639dd4151e97efbc42ee1a28b?d=blank&r=g", //nolint:lll
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://www.gravatar.com/avatar/a6b55dc639dd4151e97efbc42ee1a28b?d=blank&r=g",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "jane@acme.com",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
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
			name: "simple with custom claims",
			config: func() *controller.Config {
				c := getConfig()
				c.CustomClaims = ``
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUserWithRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithRefreshTokenParams{
						Disabled:              false,
						DisplayName:           "jane@acme.com",
						AvatarUrl:             "",
						Email:                 sql.Text("jane@acme.com"),
						PasswordHash:          pgtype.Text{}, //nolint:exhaustruct
						Ticket:                pgtype.Text{}, //nolint:exhaustruct
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      pgtype.Text{}, //nolint:exhaustruct
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
					}),
				).Return(insertResponse, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "jane@acme.com",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       false,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
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
						"x-hasura-claim1":            "value1",
						"x-hasura-claim2":            "value2",
						"x-hasura-claimarray":        `{"value1","value2"}`,
						"x-hasura-claimobject":       `{"key1":"value1","key2":"value2"}`,
						"x-hasura-claimnil":          "null",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
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
			jwtTokenFn: nil,
		},

		{
			name: "email verification needed",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        false,
						DisplayName:     "jane@acme.com",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("verifyEmail:xxxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB"),
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameEmailVerify,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=verifyEmail%3Ac2ee89db-095c-4904-b796-f6a507ee1260&type=emailVerify", //nolint:lll
							DisplayName: "jane@acme.com",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "verifyEmail:c2ee89db-095c-4904-b796-f6a507ee1260",
							RedirectTo:  "http://localhost:3000",
							Locale:      "en",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
				},
			},
			expectedResponse: api.PostSignupEmailPassword200JSONResponse{
				Session: nil,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},

		{
			name: "email not allowed",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedEmails = []string{"not@anemail.blah"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			hibp: func(ctrl *gomock.Controller) *mock.MockHIBPClient {
				mock := mock.NewMockHIBPClient(ctrl)
				return mock
			},
			customClaimer: nil,
			request: api.PostSignupEmailPasswordRequestObject{
				Body: &api.PostSignupEmailPasswordJSONRequestBody{
					Email:    "jane@acme.com",
					Password: "password",
					Options:  nil,
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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: tc.customClaimer,
				emailer:       tc.emailer,
				hibp:          tc.hibp,
			})

			resp := assertRequest(
				context.Background(), t, c.PostSignupEmailPassword, tc.request, tc.expectedResponse,
			)

			resp200, ok := resp.(api.PostSignupEmailPassword200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
