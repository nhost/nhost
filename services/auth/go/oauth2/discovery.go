package oauth2

import (
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) BuildDiscoveryResponse() api.OAuth2DiscoveryResponse {
	issuer := p.signer.Issuer()

	authEndpoint := issuer + "/oauth2/authorize"
	tokenEndpoint := issuer + "/oauth2/token"
	userinfoEndpoint := issuer + "/oauth2/userinfo"
	jwksURI := issuer + "/oauth2/jwks"
	revocationEndpoint := issuer + "/oauth2/revoke"
	introspectionEndpoint := issuer + "/oauth2/introspect"
	registrationEndpoint := issuer + "/oauth2/register"

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
			"graphql",
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
	resp.Set("authorization_response_iss_parameter_supported", true)

	if p.config.CIMDEnabled {
		resp.Set("client_id_metadata_document_supported", true)
	}

	return resp
}

func (p *Provider) JWKS() []api.JWK {
	return p.jwksProvider.JWKS()
}
