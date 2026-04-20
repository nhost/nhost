package controller_test

import (
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
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestSignUpIdToken(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.EmailPasswordlessEnabled = true

		return config
	}

	nonce := "4laVSZd0rNanAE0TS5iouQ=="
	token := testToken(t, nonce)

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	insertResponse := sql.InsertUserWithUserProviderAndRefreshTokenRow{
		ID:             userID,
		RefreshTokenID: refreshTokenID,
	}

	cases := []testRequest[api.SignUpIdTokenRequestObject, api.SignUpIdTokenResponseObject]{
		{ //nolint:dupl
			name:   "success - new user signup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "Jane",
						AvatarUrl:             "https://myapp.local/jane.jpg",
						Email:                 sql.Text("jane@myapp.local"),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         true,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "fake",
						ProviderUserID:        "106964149809169421082",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.SignUpIdTokenRequestObject{
				Body: &api.SignUpIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: api.SignUpIdToken200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "db477732-48fa-4289-b694-2886a646b6eb",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://myapp.local/jane.jpg",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane",
						Email:               ptr(types.Email("jane@myapp.local")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
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
			name: "error - signup disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableSignup = true

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpIdTokenRequestObject{
				Body: &api.SignUpIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name:   "error - user already exists by provider id",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID: userID,
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct //nolint:exhaustruct
						Time: time.Now(),
					},
					Disabled:    false,
					DisplayName: "Jane",
					Email:       sql.Text("jane@myapp.local"),
				}, nil)

				return mock
			},
			request: api.SignUpIdTokenRequestObject{
				Body: &api.SignUpIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name:   "error - user already exists by email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@myapp.local"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID: userID,
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time: time.Now(),
					},
					Disabled:    false,
					DisplayName: "Jane",
					Email:       sql.Text("jane@myapp.local"),
				}, nil)

				return mock
			},
			request: api.SignUpIdTokenRequestObject{
				Body: &api.SignUpIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "user-already-exists",
				Message: "User already exists",
				Status:  409,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name: "error - email not allowed",
			config: func() *controller.Config {
				c := getConfig()
				c.AllowedEmails = []string{"not@anemail.blah"}

				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignUpIdTokenRequestObject{
				Body: &api.SignUpIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp := assertRequest(
				t.Context(),
				t,
				c.SignUpIdToken,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.SignUpIdToken200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
