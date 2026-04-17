package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
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
	OID   string `json:"oid"`
	Email string `json:"email"`
	Name  string `json:"name"`
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

	// Only the `email` claim represents a real external email Azure AD has
	// associated with the account. `preferred_username` and `upn` are internal
	// directory identifiers that can be set to arbitrary values (e.g. a custom
	// UPN like `ceo@target-company.com`) and do not prove email ownership.
	//
	// The legacy v1 `/openid/userinfo` endpoint does not expose an
	// `email_verified` claim, so there is no explicit signal to report and
	// the status is Unknown. For stricter verification, use the Entra ID
	// provider, which returns `email_verified` via Microsoft Graph's OIDC
	// userinfo endpoint.
	return oidc.Profile{
		ProviderUserID: userProfile.OID,
		Email:          userProfile.Email,
		EmailVerified:  oidc.EmailVerificationStatusUnknown,
		Name:           userProfile.Name,
		Picture:        "",
	}, nil
}

func (a *AzureAD) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return a.Config.AuthCodeURL(state, opts...)
}
