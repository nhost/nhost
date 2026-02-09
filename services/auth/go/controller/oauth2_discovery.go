package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) buildDiscoveryResponse() api.OAuth2DiscoveryResponse {
	issuer := oauth2Issuer(&ctrl.config)
	baseURL := ctrl.config.ServerURL.String()

	authEndpoint := baseURL + "/oauth2/authorize"
	tokenEndpoint := baseURL + "/oauth2/token"
	userinfoEndpoint := baseURL + "/oauth2/userinfo"
	jwksURI := baseURL + "/oauth2/jwks"
	revocationEndpoint := baseURL + "/oauth2/revoke"
	introspectionEndpoint := baseURL + "/oauth2/introspect"
	registrationEndpoint := baseURL + "/oauth2/register"

	return api.OAuth2DiscoveryResponse{ //nolint:exhaustruct
		Issuer:                 issuer,
		AuthorizationEndpoint:  authEndpoint,
		TokenEndpoint:          tokenEndpoint,
		UserinfoEndpoint:       &userinfoEndpoint,
		JwksUri:                jwksURI,
		RevocationEndpoint:     &revocationEndpoint,
		IntrospectionEndpoint:  &introspectionEndpoint,
		RegistrationEndpoint:   &registrationEndpoint,
		ResponseTypesSupported: []string{"code"},
		GrantTypesSupported:    &[]string{"authorization_code", "refresh_token"},
		ScopesSupported: &[]string{
			"openid",
			"profile",
			"email",
			"phone",
			"offline_access",
		},
		SubjectTypesSupported:            &[]string{"public"},
		IdTokenSigningAlgValuesSupported: &[]string{"RS256"},
		TokenEndpointAuthMethodsSupported: &[]string{
			"client_secret_basic",
			"client_secret_post",
			"none",
		},
		CodeChallengeMethodsSupported: &[]string{"S256", "plain"},
	}
}

func (ctrl *Controller) GetOpenIDConfiguration( //nolint:ireturn
	ctx context.Context,
	_ api.GetOpenIDConfigurationRequestObject,
) (api.GetOpenIDConfigurationResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return nil, nil //nolint:nilnil
	}

	return api.GetOpenIDConfiguration200JSONResponse(ctrl.buildDiscoveryResponse()), nil
}

func (ctrl *Controller) GetOAuthAuthorizationServer( //nolint:ireturn
	ctx context.Context,
	_ api.GetOAuthAuthorizationServerRequestObject,
) (api.GetOAuthAuthorizationServerResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return nil, nil //nolint:nilnil
	}

	return api.GetOAuthAuthorizationServer200JSONResponse(ctrl.buildDiscoveryResponse()), nil
}

func (ctrl *Controller) Oauth2Jwks( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2JwksRequestObject,
) (api.Oauth2JwksResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return api.Oauth2Jwks200JSONResponse{Keys: nil}, nil
	}

	jwks := ctrl.jwtGetter.JWKS()

	keys := make([]struct {
		Alg *string `json:"alg,omitempty"`
		E   *string `json:"e,omitempty"`
		Kid *string `json:"kid,omitempty"`
		Kty *string `json:"kty,omitempty"`
		N   *string `json:"n,omitempty"`
		Use *string `json:"use,omitempty"`
	}, len(jwks))

	for i, k := range jwks {
		keys[i] = struct {
			Alg *string `json:"alg,omitempty"`
			E   *string `json:"e,omitempty"`
			Kid *string `json:"kid,omitempty"`
			Kty *string `json:"kty,omitempty"`
			N   *string `json:"n,omitempty"`
			Use *string `json:"use,omitempty"`
		}{
			Alg: ptr(k.Alg),
			E:   ptr(k.E),
			Kid: ptr(k.Kid),
			Kty: ptr(k.Kty),
			N:   ptr(k.N),
			Use: ptr(k.Use),
		}
	}

	return api.Oauth2Jwks200JSONResponse{Keys: keys}, nil
}
