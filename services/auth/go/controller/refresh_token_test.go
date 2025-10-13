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

func getAnonymousUser(userID uuid.UUID) sql.AuthUser {
	//nolint:exhaustruct
	return sql.AuthUser{
		ID: userID,
		CreatedAt: pgtype.Timestamptz{
			Time: time.Now(),
		},
		UpdatedAt:                pgtype.Timestamptz{},
		LastSeen:                 pgtype.Timestamptz{},
		Disabled:                 false,
		DisplayName:              "Anonymous User",
		AvatarUrl:                "",
		Locale:                   "en",
		Email:                    pgtype.Text{},
		PhoneNumber:              pgtype.Text{},
		PasswordHash:             pgtype.Text{},
		EmailVerified:            false,
		PhoneNumberVerified:      false,
		NewEmail:                 pgtype.Text{},
		OtpMethodLastUsed:        pgtype.Text{},
		OtpHash:                  pgtype.Text{},
		OtpHashExpiresAt:         pgtype.Timestamptz{},
		DefaultRole:              "anonymous",
		IsAnonymous:              true,
		TotpSecret:               pgtype.Text{},
		ActiveMfaType:            pgtype.Text{},
		Ticket:                   pgtype.Text{},
		TicketExpiresAt:          pgtype.Timestamptz{},
		Metadata:                 []byte("{}"),
		WebauthnCurrentChallenge: pgtype.Text{},
	}
}

func TestRefreshToken(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	token := uuid.MustParse("1fb17604-86c7-444e-b337-09a644465f2d")
	hashedToken := `\x9698157153010b858587119503cbeef0cf288f11775e51cdb6bfd65e930d9310`
	newTokenID := uuid.MustParse("1fb13604-86c7-4444-a337-09a644465f2d")

	cases := []testRequest[api.RefreshTokenRequestObject, api.RefreshTokenResponseObject]{
		{
			name:   "user with valid refresh token",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByRefreshTokenHash(
					gomock.Any(),
					sql.GetUserByRefreshTokenHashParams{
						RefreshTokenHash: sql.Text(hashedToken),
						Type:             "regular",
					},
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().RefreshTokenAndGetUserRoles(
					gomock.Any(),
					cmpDBParams(sql.RefreshTokenAndGetUserRolesParams{
						NewRefreshTokenHash: sql.Text(""),
						ExpiresAt: sql.TimestampTz(
							time.Now().Add(time.Duration(2592000) * time.Second),
						),
						OldRefreshTokenHash: sql.Text(hashedToken),
					}),
				).Return([]sql.RefreshTokenAndGetUserRolesRow{
					{Role: sql.Text("user"), RefreshTokenID: newTokenID},
					{Role: sql.Text("me"), RefreshTokenID: newTokenID},
				}, nil)

				return mock
			},
			request: api.RefreshTokenRequestObject{
				Body: &api.RefreshTokenRequest{
					RefreshToken: token.String(),
				},
			},
			expectedResponse: api.RefreshToken200JSONResponse(
				api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					RefreshTokenId:       "1fb13604-86c7-4444-a337-09a644465f2d",
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
			),
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
			name:   "anonymous user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByRefreshTokenHash(
					gomock.Any(),
					sql.GetUserByRefreshTokenHashParams{
						RefreshTokenHash: sql.Text(hashedToken),
						Type:             "regular",
					},
				).Return(getAnonymousUser(userID), nil)

				mock.EXPECT().RefreshTokenAndGetUserRoles(
					gomock.Any(),
					cmpDBParams(sql.RefreshTokenAndGetUserRolesParams{
						NewRefreshTokenHash: sql.Text(""),
						ExpiresAt: sql.TimestampTz(
							time.Now().Add(time.Duration(2592000) * time.Second),
						),
						OldRefreshTokenHash: sql.Text(hashedToken),
					}),
				).Return([]sql.RefreshTokenAndGetUserRolesRow{
					{Role: sql.Text("anonymous"), RefreshTokenID: newTokenID},
				}, nil)

				return mock
			},
			request: api.RefreshTokenRequestObject{
				Body: &api.RefreshTokenRequest{
					RefreshToken: token.String(),
				},
			},
			expectedResponse: api.RefreshToken200JSONResponse(
				api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					RefreshTokenId:       "1fb13604-86c7-4444-a337-09a644465f2d",
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
						Metadata:            map[string]any{},
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"anonymous"},
						ActiveMfaType:       nil,
					},
				},
			),
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
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name: "invalid refresh token",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.AllowedEmails = []string{"asd@asd.com"}
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByRefreshTokenHash(
					gomock.Any(),
					sql.GetUserByRefreshTokenHashParams{
						RefreshTokenHash: sql.Text(hashedToken),
						Type:             "regular",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.RefreshTokenRequestObject{
				Body: &api.RefreshTokenRequest{
					RefreshToken: token.String(),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-refresh-token",
				Message: "Invalid or expired refresh token",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUserByRefreshTokenHash(
					gomock.Any(),
					sql.GetUserByRefreshTokenHashParams{
						RefreshTokenHash: sql.Text(hashedToken),
						Type:             "regular",
					},
				).Return(user, nil)

				return mock
			},
			request: api.RefreshTokenRequestObject{
				Body: &api.RefreshTokenRequest{
					RefreshToken: token.String(),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
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

			//nolint:exhaustruct
			resp := assertRequest(
				t.Context(),
				t,
				c.RefreshToken,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.RefreshToken200JSONResponse{},
					"RefreshToken",
					"AccessToken",
				),
			)

			resp200, ok := resp.(api.RefreshToken200JSONResponse)
			if ok {
				session := api.Session(resp200)
				assertSession(t, jwtGetter, &session, tc.expectedJWT)
			}
		})
	}
}
