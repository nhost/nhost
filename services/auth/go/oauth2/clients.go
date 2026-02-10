package oauth2

import (
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func ClientToResponse(c sql.AuthOauth2Client) api.OAuth2ClientResponse {
	accessTokenLifetime := int(c.AccessTokenLifetime)
	refreshTokenLifetime := int(c.RefreshTokenLifetime)

	resp := api.OAuth2ClientResponse{ //nolint:exhaustruct
		ClientId:             c.ClientID,
		ClientName:           c.ClientName,
		RedirectUris:         c.RedirectUris,
		GrantTypes:           &c.GrantTypes,
		ResponseTypes:        &c.ResponseTypes,
		Scopes:               &c.Scopes,
		IsPublic:             &c.IsPublic,
		AccessTokenLifetime:  &accessTokenLifetime,
		RefreshTokenLifetime: &refreshTokenLifetime,
		CreatedAt:            timePtr(c.CreatedAt),
		UpdatedAt:            timePtr(c.UpdatedAt),
	}

	if c.ClientUri.Valid {
		resp.ClientUri = &c.ClientUri.String
	}

	if c.LogoUri.Valid {
		resp.LogoUri = &c.LogoUri.String
	}

	resp.TokenEndpointAuthMethod = &c.TokenEndpointAuthMethod

	return resp
}

func GenerateClientID() string {
	return "nhost_" + HashToken(uuid.NewString())[:16]
}
