package controller_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestOauth2Token(t *testing.T) {
	t.Parallel()

	cases := []testRequest[api.Oauth2TokenRequestObject, api.Oauth2TokenResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.AuthorizationCode,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "missing body",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2TokenRequestObject{
				Body: nil,
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_request",
					ErrorDescription: ptr("Missing request body"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "unsupported grant type",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.OAuth2TokenRequestGrantType("client_credentials"),
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "unsupported_grant_type",
					ErrorDescription: ptr("Unsupported grant_type"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "authorization_code - missing code",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.AuthorizationCode,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_request",
					ErrorDescription: ptr("Missing code"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "authorization_code - invalid code",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2AuthorizationCodeAuthRequest(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthOauth2AuthRequest{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.AuthorizationCode,
					Code:      ptr("invalid-code"),
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_grant",
					ErrorDescription: ptr("Invalid authorization code"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "refresh_token - missing refresh_token",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.RefreshToken,
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_request",
					ErrorDescription: ptr("Missing refresh_token"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "refresh_token - invalid refresh_token",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2RefreshTokenByHash(
					gomock.Any(), gomock.Any(),
				).Return(sql.AuthOauth2RefreshToken{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType:    api.RefreshToken,
					RefreshToken: ptr("invalid-token"),
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_grant",
					ErrorDescription: ptr("Invalid refresh token"),
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Token,
				tc.request, tc.expectedResponse,
			)
		})
	}

	t.Run("credentials in both body and basic auth header", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		clientID := "body-client-id"

		w := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(w)
		ginCtx.Request = httptest.NewRequest(http.MethodPost, "/oauth/token", nil)
		ginCtx.Request.SetBasicAuth("header-client-id", "header-client-secret")

		assertRequest[api.Oauth2TokenRequestObject, api.Oauth2TokenResponseObject](
			ginCtx, t, c.Oauth2Token,
			api.Oauth2TokenRequestObject{
				Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
					GrantType: api.AuthorizationCode,
					ClientId:  &clientID,
				},
			},
			controller.OAuth2ErrorResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.OAuth2ErrorResponse{
					Error: "invalid_request",
					ErrorDescription: ptr(
						"client credentials MUST NOT be provided in " +
							"both the Authorization header and the request body",
					),
				},
			},
		)
	})

	t.Run("credentials from basic auth header only", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfigOAuth2Enabled,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		w := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(w)
		ginCtx.Request = httptest.NewRequest(http.MethodPost, "/oauth/token", nil)
		ginCtx.Request.SetBasicAuth("header-client-id", "header-client-secret")

		resp, err := c.Oauth2Token(ginCtx, api.Oauth2TokenRequestObject{
			Body: &api.OAuth2TokenRequest{ //nolint:exhaustruct
				GrantType: api.AuthorizationCode,
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should not be rejected for dual credentials - basic auth is the sole source.
		// It may fail downstream for other reasons (missing code, etc.) but should
		// NOT fail with the dual-credentials error message.
		dualCredsMsg := "client credentials MUST NOT be provided in " +
			"both the Authorization header and the request body"
		if defaultResp, ok := resp.(controller.OAuth2ErrorResponse); ok {
			if defaultResp.Body.ErrorDescription != nil &&
				*defaultResp.Body.ErrorDescription == dualCredsMsg {
				t.Errorf("should not reject credentials from basic auth header only")
			}
		}
	})
}
