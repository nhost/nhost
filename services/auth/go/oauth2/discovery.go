package oauth2

import (
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) BuildDiscoveryResponse() api.OAuth2DiscoveryResponse {
	issuer := p.signer.Issuer()

	var cimdSupported *bool
	if p.config.CIMDEnabled {
		cimdSupported = new(true)
	}

	return api.OAuth2DiscoveryResponse{
		Issuer:                 issuer,
		AuthorizationEndpoint:  issuer + "/oauth2/authorize",
		TokenEndpoint:          issuer + "/oauth2/token",
		UserinfoEndpoint:       new(issuer + "/oauth2/userinfo"),
		JwksUri:                issuer + "/oauth2/jwks",
		RevocationEndpoint:     new(issuer + "/oauth2/revoke"),
		IntrospectionEndpoint:  new(issuer + "/oauth2/introspect"),
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
		IdTokenSigningAlgValuesSupported: &[]string{p.signer.Alg()},
		TokenEndpointAuthMethodsSupported: &[]string{
			"client_secret_basic",
			"client_secret_post",
			"none",
		},
		CodeChallengeMethodsSupported: &[]string{"S256"},
		ClaimsSupported: &[]string{
			"sub",
			"name",
			"email",
			"email_verified",
			"picture",
			"locale",
			"phone_number",
			"phone_number_verified",
		},
		RequestParameterSupported:                  new(false),
		AuthorizationResponseIssParameterSupported: new(true),
		ClientIdMetadataDocumentSupported:          cimdSupported,
	}
}

func (p *Provider) JWKS() []api.JWK {
	return p.jwks
}
