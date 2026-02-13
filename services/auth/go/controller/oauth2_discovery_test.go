package controller_test

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
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
			request:          api.GetOpenIDConfigurationRequestObject{},
			expectedResponse: nil,
			expectedJWT:      nil,
			jwtTokenFn:       nil,
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
				RegistrationEndpoint:   ptr("https://local.auth.nhost.run/oauth2/register"),
				ResponseTypesSupported: []string{"code"},
				GrantTypesSupported:    &[]string{"authorization_code", "refresh_token"},
				ScopesSupported: &[]string{
					"openid", "profile", "email", "phone", "offline_access", "graphql",
				},
				SubjectTypesSupported:            &[]string{"public"},
				IdTokenSigningAlgValuesSupported: &[]string{"RS256"},
				TokenEndpointAuthMethodsSupported: &[]string{
					"client_secret_basic", "client_secret_post", "none",
				},
				CodeChallengeMethodsSupported: &[]string{"S256"},
				AdditionalProperties: map[string]any{
					"request_parameter_supported":                    false,
					"authorization_response_iss_parameter_supported": true,
				},
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
			request:          api.GetOAuthAuthorizationServerRequestObject{},
			expectedResponse: nil,
			expectedJWT:      nil,
			jwtTokenFn:       nil,
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
				RegistrationEndpoint:   ptr("https://local.auth.nhost.run/oauth2/register"),
				ResponseTypesSupported: []string{"code"},
				GrantTypesSupported:    &[]string{"authorization_code", "refresh_token"},
				ScopesSupported: &[]string{
					"openid", "profile", "email", "phone", "offline_access", "graphql",
				},
				SubjectTypesSupported:            &[]string{"public"},
				IdTokenSigningAlgValuesSupported: &[]string{"RS256"},
				TokenEndpointAuthMethodsSupported: &[]string{
					"client_secret_basic", "client_secret_post", "none",
				},
				CodeChallengeMethodsSupported: &[]string{"S256"},
				AdditionalProperties: map[string]any{
					"request_parameter_supported":                    false,
					"authorization_response_iss_parameter_supported": true,
				},
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

	t.Run("no key manager", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)

		c, _ := getController(
			t,
			ctrl,
			getConfig,
			func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
		)

		resp, err := c.Oauth2Jwks(context.Background(), api.Oauth2JwksRequestObject{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expected := api.Oauth2Jwks200JSONResponse{Keys: nil}

		if diff := cmp.Diff(expected, resp); diff != "" {
			t.Errorf("unexpected response (-want +got):\n%s", diff)
		}
	})
}
