package oauth2

import (
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) BuildDiscoveryResponse() api.OAuth2DiscoveryResponse {
	issuer := p.Issuer()
	baseURL := p.config.ServerURL

	authEndpoint := baseURL + "/oauth2/authorize"
	tokenEndpoint := baseURL + "/oauth2/token"
	userinfoEndpoint := baseURL + "/oauth2/userinfo"
	jwksURI := baseURL + "/oauth2/jwks"
	revocationEndpoint := baseURL + "/oauth2/revoke"
	introspectionEndpoint := baseURL + "/oauth2/introspect"
	registrationEndpoint := baseURL + "/oauth2/register"

	resp := api.OAuth2DiscoveryResponse{ //nolint:exhaustruct
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
		CodeChallengeMethodsSupported: &[]string{"S256"},
	}

	resp.Set("request_parameter_supported", false)

	if p.config.CIMDEnabled {
		resp.Set("client_id_metadata_document_supported", true)
	}

	return resp
}

func (p *Provider) JWKS() []api.JWK {
	return p.jwksProvider.JWKS()
}
