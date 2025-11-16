package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type AzureAD struct {
	*oauth2.Config

	ProfileURL string
}

func formatAzureADURL(tenant, path string) string {
	return fmt.Sprintf("https://login.microsoftonline.com/%s%s", tenant, path)
}

func NewAzureadProvider(
	clientID, clientSecret, authServerURL, tenant string,
	scopes []string,
) *Provider {
	azuread := &AzureAD{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/azuread/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  formatAzureADURL(tenant, "/oauth2/authorize?prompt=select_account"),
				TokenURL: formatAzureADURL(tenant, "/oauth2/token"),
			},
		},
		ProfileURL: formatAzureADURL(tenant, "/openid/userinfo"),
	}

	return NewOauth2Provider(azuread)
}

type azureUser struct {
	OID    string `json:"oid"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	UPN    string `json:"upn"`
	Prefer string `json:"preferred_username"`
}

func (a *AzureAD) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile azureUser
	if err := fetchOAuthProfile(
		ctx,
		a.ProfileURL,
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("AzureAD API error: %w", err)
	}

	email := userProfile.Email
	if email == "" {
		email = userProfile.Prefer
	}

	if email == "" {
		email = userProfile.UPN
	}

	return oidc.Profile{
		ProviderUserID: userProfile.OID,
		Email:          email,
		EmailVerified:  email != "",
		Name:           userProfile.Name,
		Picture:        "",
	}, nil
}
