package controller_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/tokenpurpose"
	"go.uber.org/mock/gomock"
)

func TestVerifyToken(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	config := getConfig()

	signingGetter, err := controller.NewJWTGetter(
		[]byte(config.JWTSecret), time.Hour, nil, "", nil, config.ServerURL.String(),
	)
	if err != nil {
		t.Fatalf("failed to create signing jwt getter: %v", err)
	}

	sessionToken := signTestToken(t, signingGetter, userID, tokenpurpose.Session, nil)
	oauth2AccessToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OAuth2AccessToken,
		map[string]any{"aud": "some-client", "scope": "openid graphql"},
	)
	oidcIDToken := signTestToken(
		t, signingGetter, userID, tokenpurpose.OIDCIDToken,
		map[string]any{"aud": "some-client"},
	)

	invalidRequest := controller.ErrorResponse{
		Error:   "invalid-request",
		Message: "The request payload is incorrect",
		Status:  400,
	}

	cases := []testRequest[api.VerifyTokenRequestObject, api.VerifyTokenResponseObject]{
		{
			name:   "session token in body",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: &api.VerifyTokenRequest{
					Token: &sessionToken,
				},
			},
			expectedResponse:  api.VerifyToken200JSONResponse("OK"),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "OAuth2 access token in body is not a session",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: &api.VerifyTokenRequest{
					Token: &oauth2AccessToken,
				},
			},
			expectedResponse:  invalidRequest,
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "OIDC ID token in body is not a session",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: &api.VerifyTokenRequest{
					Token: &oidcIDToken,
				},
			},
			expectedResponse:  invalidRequest,
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "error with no token provided",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: &api.VerifyTokenRequest{
					Token: nil,
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
			name:   "error with nil body",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: nil,
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
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp, err := c.VerifyToken(t.Context(), tc.request)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expectedResponse, resp); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}
