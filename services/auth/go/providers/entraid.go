package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type EntraID struct {
	*oauth2.Config

	ProfileURL string
}

func NewEntraIDProvider(
	clientID, clientSecret, authServerURL, tenant string,
	scopes []string,
) *Provider {
	baseURL := "https://login.microsoftonline.com/" + tenant + "/oauth2/v2.0"

	entraid := &EntraID{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/entraid/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  baseURL + "/authorize",
				TokenURL: baseURL + "/token",
			},
		},
		ProfileURL: "https://graph.microsoft.com/oidc/userinfo",
	}

	return NewOauth2Provider(entraid)
}

type entraidUser struct {
	Sub        string `json:"sub"`
	GivenName  string `json:"givenname"`
	FamilyName string `json:"familyname"`
	Email      string `json:"email"`
}

func (a *EntraID) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile entraidUser
	if err := fetchOAuthProfile(
		ctx,
		a.ProfileURL,
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("EntraID API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: userProfile.Sub,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Name:           userProfile.GivenName + " " + userProfile.FamilyName,
		Picture:        "",
	}, nil
}
