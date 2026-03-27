package controller_test

import (
	"crypto/sha256"
	"encoding/base64"
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
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func s256Challenge(codeVerifier string) string {
	h := sha256.Sum256([]byte(codeVerifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func TestTokenExchange(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")

	// Valid PKCE pair (verifier must be 43-128 chars)
	codeVerifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-43chars"
	codeChallenge := s256Challenge(codeVerifier)

	authorizationCode := "test-authorization-code-value"
	codeHash := pkce.HashCode(authorizationCode)

	cases := []testRequest[api.TokenExchangeRequestObject, api.TokenExchangeResponseObject]{
		{
			name:   "successful token exchange",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().ConsumePKCEAuthorizationCode(
					gomock.Any(),
					codeHash,
				).Return(sql.AuthPkceAuthorizationCode{
					ID:            uuid.New(),
					UserID:        userID,
					CodeHash:      codeHash,
					CodeChallenge: codeChallenge,
					RedirectTo:    sql.Text("http://localhost:3000"),
					ExpiresAt:     sql.TimestampTz(time.Now().Add(5 * time.Minute)),
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time:  time.Now(),
						Valid: true,
					},
				}, nil)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					gomock.Any(),
				).Return(refreshTokenID, nil)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"}, //nolint:exhaustruct
					{UserID: userID, Role: "me"},   //nolint:exhaustruct
				}, nil)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(pgtype.Timestamptz{Time: time.Now(), Valid: true}, nil) //nolint:exhaustruct

				return mock
			},
			request: api.TokenExchangeRequestObject{
				Body: &api.TokenExchangeRequest{
					Code:         authorizationCode,
					CodeVerifier: codeVerifier,
				},
			},
			expectedResponse: api.TokenExchange200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshToken:         "",
					RefreshTokenId:       refreshTokenID.String(),
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
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "invalid authorization code",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().ConsumePKCEAuthorizationCode(
					gomock.Any(),
					gomock.Any(),
				).Return(sql.AuthPkceAuthorizationCode{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.TokenExchangeRequestObject{
				Body: &api.TokenExchangeRequest{
					Code:         "invalid-code",
					CodeVerifier: codeVerifier,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "wrong code verifier",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().ConsumePKCEAuthorizationCode(
					gomock.Any(),
					codeHash,
				).Return(sql.AuthPkceAuthorizationCode{
					ID:            uuid.New(),
					UserID:        userID,
					CodeHash:      codeHash,
					CodeChallenge: codeChallenge,
					RedirectTo:    sql.Text("http://localhost:3000"),
					ExpiresAt:     sql.TimestampTz(time.Now().Add(5 * time.Minute)),
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time:  time.Now(),
						Valid: true,
					},
				}, nil)

				return mock
			},
			request: api.TokenExchangeRequestObject{
				Body: &api.TokenExchangeRequest{
					Code:         authorizationCode,
					CodeVerifier: "wrong-code-verifier-that-is-at-least-43-chars-long-to-pass-length-check",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "user not found after code exchange",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().ConsumePKCEAuthorizationCode(
					gomock.Any(),
					codeHash,
				).Return(sql.AuthPkceAuthorizationCode{
					ID:            uuid.New(),
					UserID:        userID,
					CodeHash:      codeHash,
					CodeChallenge: codeChallenge,
					RedirectTo:    sql.Text("http://localhost:3000"),
					ExpiresAt:     sql.TimestampTz(time.Now().Add(5 * time.Minute)),
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time:  time.Now(),
						Valid: true,
					},
				}, nil)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.TokenExchangeRequestObject{
				Body: &api.TokenExchangeRequest{
					Code:         authorizationCode,
					CodeVerifier: codeVerifier,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
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
				c.TokenExchange,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.TokenExchange200JSONResponse{}, //nolint:exhaustruct
					"Session.RefreshToken",
					"Session.AccessToken",
				),
			)

			resp200, ok := resp.(api.TokenExchange200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
