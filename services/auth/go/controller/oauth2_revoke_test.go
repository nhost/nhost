package controller_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func TestOauth2Revoke(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"
	client := testOAuth2Client()

	cases := []testRequest[api.Oauth2RevokeRequestObject, api.Oauth2RevokeResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2RevokeRequestObject{
				Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
					Token: "some-token",
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
			request: api.Oauth2RevokeRequestObject{
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
			name:   "missing client_id",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2RevokeRequestObject{
				Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
					Token: "some-token",
				},
			},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusUnauthorized,
				Body: api.OAuth2ErrorResponse{
					Error:            "invalid_client",
					ErrorDescription: ptr("Client ID is required"),
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				mock.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(client, nil)
				mock.EXPECT().DeleteOAuth2RefreshTokenByHashAndClientID(
					gomock.Any(), gomock.Any(),
				).Return(nil)

				return mock
			},
			request: api.Oauth2RevokeRequestObject{
				Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
					Token:    "some-token",
					ClientId: &clientID,
				},
			},
			expectedResponse: api.Oauth2Revoke200Response{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Revoke,
				tc.request, tc.expectedResponse,
			)
		})
	}

	t.Run("dual credentials", func(t *testing.T) {
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

		bodyClientID := "body-client-id"

		w := httptest.NewRecorder()
		ginCtx, _ := gin.CreateTestContext(w)
		ginCtx.Request = httptest.NewRequest(
			http.MethodPost, "/oauth2/revoke", nil,
		)
		ginCtx.Request.SetBasicAuth("header-client-id", "header-client-secret")

		assertRequest[api.Oauth2RevokeRequestObject, api.Oauth2RevokeResponseObject](
			ginCtx, t, c.Oauth2Revoke,
			api.Oauth2RevokeRequestObject{
				Body: &api.OAuth2RevokeRequest{ //nolint:exhaustruct
					Token:    "some-token",
					ClientId: &bodyClientID,
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
}
