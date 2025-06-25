package controller_test

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func TestPostSignout(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	token := uuid.MustParse("1fb17604-86c7-444e-b337-09a644465f2d")
	hashedToken := `\x9698157153010b858587119503cbeef0cf288f11775e51cdb6bfd65e930d9310`

	cases := []testRequest[api.PostSignoutRequestObject, api.PostSignoutResponseObject]{
		{
			name:   "sign out from current session only",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().DeleteRefreshToken(
					gomock.Any(),
					pgtype.Text{String: hashedToken, Valid: true},
				).Return(nil)

				return mock
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          ptr(false),
				},
			},
			expectedResponse:  api.PostSignout200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "sign out from current session only (default)",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().DeleteRefreshToken(
					gomock.Any(),
					pgtype.Text{String: hashedToken, Valid: true},
				).Return(nil)

				return mock
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          nil, // All is nil, should default to false
				},
			},
			expectedResponse:  api.PostSignout200JSONResponse(api.OK),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "sign out from all sessions - authenticated user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(),
					userID,
				).Return(nil)

				return mock
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          ptr(true),
				},
			},
			expectedResponse: api.PostSignout200JSONResponse(api.OK),
			expectedJWT:      nil,
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: &jwt.MapClaims{
						"sub": userID.String(),
						"iss": "hasura-auth",
						"aud": "hasura-auth",
						"exp": float64(1234567890),
						"iat": float64(1234567890),
						"https://hasura.io/jwt/claims": map[string]any{
							"x-hasura-allowed-roles": []any{"user", "admin"},
							"x-hasura-default-role":  "user",
							"x-hasura-user-id":       userID.String(),
						},
					},
					Signature: []byte("signature"),
					Valid:     true,
				}
			},
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "sign out from all sessions - unauthenticated user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          ptr(true),
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
			name:   "error deleting single refresh token",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().DeleteRefreshToken(
					gomock.Any(),
					pgtype.Text{String: hashedToken, Valid: true},
				).Return(pgx.ErrNoRows)

				return mock
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          ptr(false),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "error deleting all refresh tokens",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().DeleteRefreshTokens(
					gomock.Any(),
					userID,
				).Return(pgx.ErrNoRows)

				return mock
			},
			request: api.PostSignoutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: ptr(token.String()),
					All:          ptr(true),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT: nil,
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: &jwt.MapClaims{
						"sub": userID.String(),
						"iss": "hasura-auth",
						"aud": "hasura-auth",
						"exp": float64(1234567890),
						"iat": float64(1234567890),
						"https://hasura.io/jwt/claims": map[string]any{
							"x-hasura-allowed-roles": []any{"user", "admin"},
							"x-hasura-default-role":  "user",
							"x-hasura-user-id":       userID.String(),
						},
					},
					Signature: []byte("signature"),
					Valid:     true,
				}
			},
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			}

			assertRequest(
				ctx, t, c.PostSignout, tc.request, tc.expectedResponse,
			)
		})
	}
}
