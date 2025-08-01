package providers

import (
	"context"
	"fmt"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
)

type AzureAD struct {
	*oauth2.Config

	Tenant       string
	ProfileURL   string
	CustomParams map[string]string
}

func NewAzureadProvider(
	clientID, clientSecret, authServerURL, tenant string,
	scopes []string,
) *Provider {
	baseURL := "https://login.microsoftonline.com/" + tenant + "/oauth2/v2.0"

	azuread := &AzureAD{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/azuread/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  baseURL + "/authorize",
				TokenURL: baseURL + "/token",
			},
		},
		Tenant:       tenant,
		ProfileURL:   "https://graph.microsoft.com/oidc/userinfo",
		CustomParams: map[string]string{"prompt": "select_account"},
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
