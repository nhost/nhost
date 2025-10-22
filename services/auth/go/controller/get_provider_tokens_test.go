package controller_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestGetProviderTokens(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

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

	cases := []testRequest[api.GetProviderTokensRequestObject, api.GetProviderTokensResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("804d6a8c952d1e87b5bba465d131890b802dc4c86ba676bc66d6fcc4cb659b43cf29df27fafb7a17813a88a676ffa5f372e84c70829e74d517c9fc05c03bcd838cc2fb15c5b675c520674cd3beed7bcf21f2f852a0f8a8fc183bd93aa51111c2de2405ca8c52df34e7bbfc45a901c8f5a235363f1ca3a879", nil) //nolint:lll

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: api.GetProviderTokens200JSONResponse{
				AccessToken:  "valid-accesstoken-1",
				ExpiresIn:    9000,
				RefreshToken: ptr("valid-refreshtoken-1"),
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    true,
				}, nil)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "session not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("", pgx.ErrNoRows)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: api.GetProviderTokens200JSONResponse{
				AccessToken:  "",
				ExpiresIn:    0,
				RefreshToken: nil,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("", errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "missing jwt",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  http.StatusBadRequest,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			}

			assertRequest(
				ctx, t, c.GetProviderTokens, tc.request, tc.expectedResponse,
			)
		})
	}
}
