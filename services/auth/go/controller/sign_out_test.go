package controller_test

import (
	"bytes"
	"log/slog"
	"net/http"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func TestSignOut(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	token := uuid.MustParse("1fb17604-86c7-444e-b337-09a644465f2d")
	hashedToken := `\x9698157153010b858587119503cbeef0cf288f11775e51cdb6bfd65e930d9310`

	cases := []testRequest[api.SignOutRequestObject, api.SignOutResponseObject]{
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          new(false),
				},
			},
			expectedResponse:  api.SignOut200JSONResponse(api.OK),
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          nil, // All is nil, should default to false
				},
			},
			expectedResponse:  api.SignOut200JSONResponse(api.OK),
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          new(true),
				},
			},
			expectedResponse: api.SignOut200JSONResponse(api.OK),
			expectedJWT:      nil,
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "nhost-session+jwt",
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          new(true),
				},
			},
			expectedResponse: api.SignOutdefaultJSONResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.ErrorResponse{
					Status:  http.StatusUnauthorized,
					Error:   api.InvalidRequest,
					Message: "User is not authenticated",
				},
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          new(false),
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
			request: api.SignOutRequestObject{
				Body: &api.SignOutRequest{
					RefreshToken: new(token.String()),
					All:          new(true),
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
						"typ": "nhost-session+jwt",
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
				ctx, t, c.SignOut, tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestSignOutAllUnauthenticatedDoesNotLogError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	c, _ := getController(
		t,
		ctrl,
		getConfig,
		func(ctrl *gomock.Controller) controller.DBClient {
			return mock.NewMockDBClient(ctrl)
		},
	)

	var logBuf bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logBuf, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	ctx := oapimw.LoggerToContext(t.Context(), logger)

	resp, err := c.SignOut(ctx, api.SignOutRequestObject{
		Body: &api.SignOutRequest{
			RefreshToken: nil,
			All:          new(true),
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got, ok := resp.(api.SignOutdefaultJSONResponse)
	if !ok {
		t.Fatalf("expected api.SignOutdefaultJSONResponse, got %T", resp)
	}

	if got.StatusCode != http.StatusUnauthorized || got.Body.Status != http.StatusUnauthorized {
		t.Fatalf("expected 401 unauthorized response, got %+v", got)
	}

	if bytes.Contains(logBuf.Bytes(), []byte("level=ERROR")) ||
		bytes.Contains(logBuf.Bytes(), []byte("level=WARN")) {
		t.Fatalf("expected no error/warn log, got: %s", logBuf.String())
	}
}
