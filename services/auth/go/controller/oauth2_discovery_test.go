package controller_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func getConfigOAuth2Enabled() *controller.Config {
	config := getConfig()
	config.OAuth2ProviderEnabled = true
	config.OAuth2ProviderLoginURL = "https://auth.example.com/oauth2/consent"
	config.JWTSecret = `{"type":"HS256", "key":"5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3","issuer":"https://local.auth.nhost.run"}` //nolint:lll

	return config
}

func TestGetOpenIDConfiguration(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []testRequest[api.GetOpenIDConfigurationRequestObject, api.GetOpenIDConfigurationResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.GetOpenIDConfigurationRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.GetOpenIDConfigurationRequestObject{},
			expectedResponse: api.GetOpenIDConfiguration200JSONResponse{
				Issuer:                 "https://local.auth.nhost.run",
				AuthorizationEndpoint:  "https://local.auth.nhost.run/oauth2/authorize",
				TokenEndpoint:          "https://local.auth.nhost.run/oauth2/token",
				UserinfoEndpoint:       ptr("https://local.auth.nhost.run/oauth2/userinfo"),
				JwksUri:                "https://local.auth.nhost.run/oauth2/jwks",
				RevocationEndpoint:     ptr("https://local.auth.nhost.run/oauth2/revoke"),
				IntrospectionEndpoint:  ptr("https://local.auth.nhost.run/oauth2/introspect"),
				ResponseTypesSupported: []string{"code"},
				GrantTypesSupported:    &[]string{"authorization_code", "refresh_token"},
				ScopesSupported: &[]string{
					"openid", "profile", "email", "phone", "offline_access", "graphql",
				},
				SubjectTypesSupported:            &[]string{"public"},
				IdTokenSigningAlgValuesSupported: &[]string{"HS256"},
				TokenEndpointAuthMethodsSupported: &[]string{
					"client_secret_basic", "client_secret_post", "none",
				},
				CodeChallengeMethodsSupported: &[]string{"S256"},
				ClaimsSupported: &[]string{
					"sub", "name", "email", "email_verified",
					"picture", "locale", "phone_number", "phone_number_verified",
				},
				RequestParameterSupported:                  ptr(false),
				AuthorizationResponseIssParameterSupported: ptr(true),
				ClientIdMetadataDocumentSupported:          nil,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.GetOpenIDConfiguration,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestGetOAuthAuthorizationServer(t *testing.T) { //nolint:dupl
	t.Parallel()

	cases := []testRequest[api.GetOAuthAuthorizationServerRequestObject, api.GetOAuthAuthorizationServerResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.GetOAuthAuthorizationServerRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.GetOAuthAuthorizationServerRequestObject{},
			expectedResponse: api.GetOAuthAuthorizationServer200JSONResponse{
				Issuer:                 "https://local.auth.nhost.run",
				AuthorizationEndpoint:  "https://local.auth.nhost.run/oauth2/authorize",
				TokenEndpoint:          "https://local.auth.nhost.run/oauth2/token",
				UserinfoEndpoint:       ptr("https://local.auth.nhost.run/oauth2/userinfo"),
				JwksUri:                "https://local.auth.nhost.run/oauth2/jwks",
				RevocationEndpoint:     ptr("https://local.auth.nhost.run/oauth2/revoke"),
				IntrospectionEndpoint:  ptr("https://local.auth.nhost.run/oauth2/introspect"),
				ResponseTypesSupported: []string{"code"},
				GrantTypesSupported:    &[]string{"authorization_code", "refresh_token"},
				ScopesSupported: &[]string{
					"openid", "profile", "email", "phone", "offline_access", "graphql",
				},
				SubjectTypesSupported:            &[]string{"public"},
				IdTokenSigningAlgValuesSupported: &[]string{"HS256"},
				TokenEndpointAuthMethodsSupported: &[]string{
					"client_secret_basic", "client_secret_post", "none",
				},
				CodeChallengeMethodsSupported: &[]string{"S256"},
				ClaimsSupported: &[]string{
					"sub", "name", "email", "email_verified",
					"picture", "locale", "phone_number", "phone_number_verified",
				},
				RequestParameterSupported:                  ptr(false),
				AuthorizationResponseIssParameterSupported: ptr(true),
				ClientIdMetadataDocumentSupported:          nil,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.GetOAuthAuthorizationServer,
				tc.request, tc.expectedResponse,
			)
		})
	}
}

func TestOauth2Jwks(t *testing.T) {
	t.Parallel()

	cases := []testRequest[api.Oauth2JwksRequestObject, api.Oauth2JwksResponseObject]{
		{ //nolint:exhaustruct
			name:   "disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.Oauth2JwksRequestObject{},
			expectedResponse: controller.OAuth2ErrorResponse{
				StatusCode: http.StatusInternalServerError,
				Body: api.OAuth2ErrorResponse{
					Error:            "server_error",
					ErrorDescription: ptr("OAuth2 provider is disabled"),
				},
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
		{ //nolint:exhaustruct
			name:   "success",
			config: getConfigOAuth2Enabled,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request:          api.Oauth2JwksRequestObject{},
			expectedResponse: api.Oauth2Jwks200JSONResponse{Keys: nil},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db)

			assertRequest(
				context.Background(), t, c.Oauth2Jwks,
				tc.request, tc.expectedResponse,
			)
		})
	}
}
