package controller_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func getConfigOAuth2DeviceEnabled() *controller.Config {
	config := getConfigOAuth2Enabled()

	return config
}

func TestOauth2DeviceAuthorization(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"
	testClient := testOAuth2Client()

	cases := []testRequest[api.Oauth2DeviceAuthorizationRequestObject, api.Oauth2DeviceAuthorizationResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2DeviceAuthorizationRequestObject{
				Body: &api.OAuth2DeviceAuthorizationRequest{
					ClientId: clientID,
					Scope:    nil,
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
			name:   "success",
			config: getConfigOAuth2DeviceEnabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2ClientByClientID(gomock.Any(), clientID).
					Return(testClient, nil)
				m.EXPECT().InsertOAuth2DeviceCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2DeviceCode{}, nil) //nolint:exhaustruct

				return m
			},
			request: api.Oauth2DeviceAuthorizationRequestObject{
				Body: &api.OAuth2DeviceAuthorizationRequest{
					ClientId: clientID,
					Scope:    nil,
				},
			},
			// We can't predict the exact response due to random codes,
			// so we just check it doesn't error.
			expectedResponse: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			c, _ := getController(t, ctrl, tc.config, tc.db)

			resp, err := c.Oauth2DeviceAuthorization(context.Background(), tc.request)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assertDeviceAuthResponse(t, resp, tc.expectedResponse)
		})
	}
}

func TestOauth2DeviceVerifyGet(t *testing.T) {
	t.Parallel()

	clientID := "nhost_abc123def456"

	cases := []testRequest[api.Oauth2DeviceVerifyGetRequestObject, api.Oauth2DeviceVerifyGetResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2DeviceVerifyGetRequestObject{
				Params: api.Oauth2DeviceVerifyGetParams{
					UserCode: "ABCD-EFGH",
				},
			},
			expectedResponse: api.Oauth2DeviceVerifyGetdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.DisabledEndpoint,
					Message: "OAuth2 provider is disabled",
				},
			},
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2DeviceEnabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByUserCode(gomock.Any(), "ABCDEFGH").
					Return(sql.AuthOauth2DeviceCode{ //nolint:exhaustruct
						ClientID: clientID,
						Scopes:   []string{"openid"},
						Status:   "pending",
					}, nil)

				return m
			},
			request: api.Oauth2DeviceVerifyGetRequestObject{
				Params: api.Oauth2DeviceVerifyGetParams{
					UserCode: "ABCD-EFGH",
				},
			},
			expectedResponse: api.Oauth2DeviceVerifyGet200JSONResponse{
				ClientId: clientID,
				Scopes:   []string{"openid"},
			},
		},
		{ //nolint:exhaustruct
			name:   "invalid user_code",
			config: getConfigOAuth2DeviceEnabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				m := mock.NewMockDBClient(ctrl)
				m.EXPECT().GetOAuth2DeviceCodeByUserCode(gomock.Any(), gomock.Any()).
					Return(sql.AuthOauth2DeviceCode{}, pgx.ErrNoRows) //nolint:exhaustruct

				return m
			},
			request: api.Oauth2DeviceVerifyGetRequestObject{
				Params: api.Oauth2DeviceVerifyGetParams{
					UserCode: "ZZZZ-ZZZZ",
				},
			},
			expectedResponse: api.Oauth2DeviceVerifyGetdefaultJSONResponse{
				StatusCode: http.StatusBadRequest,
				Body: api.ErrorResponse{
					Status:  http.StatusBadRequest,
					Error:   api.InvalidRequest,
					Message: "Unknown or expired user code",
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
				context.Background(), t, c.Oauth2DeviceVerifyGet,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func assertDeviceAuthResponse(
	t *testing.T,
	resp api.Oauth2DeviceAuthorizationResponseObject,
	expected api.Oauth2DeviceAuthorizationResponseObject,
) {
	t.Helper()

	if expected == nil {
		if _, ok := resp.(api.Oauth2DeviceAuthorization200JSONResponse); !ok {
			t.Fatalf("expected 200 response, got: %T", resp)
		}

		return
	}

	oauthErr, ok := resp.(controller.OAuth2ErrorResponse)
	if !ok {
		t.Fatalf("expected OAuth2ErrorResponse, got: %T", resp)
	}

	expectedErr, ok := expected.(controller.OAuth2ErrorResponse)
	if !ok {
		t.Fatalf("expected OAuth2ErrorResponse for expected, got: %T", expected)
	}

	if oauthErr.StatusCode != expectedErr.StatusCode {
		t.Errorf("expected status %d, got %d", expectedErr.StatusCode, oauthErr.StatusCode)
	}
}
