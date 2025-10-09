package providers

import (
	"context"
	"fmt"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

type Google struct {
	*oauth2.Config
}

func NewGoogleProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	google := &Google{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/google/callback",
			Scopes:       scopes,
			Endpoint:     endpoints.Google,
		},
	}

	return NewOauth2Provider(google)
}

type googleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (g *Google) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var user googleUser
	if err := fetchOAuthProfile(
		ctx,
		"https://www.googleapis.com/oauth2/v2/userinfo",
		accessToken,
		&user,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Google API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: user.ID,
		Email:          user.Email,
		EmailVerified:  user.VerifiedEmail,
		Name:           user.Name,
		Picture:        user.Picture,
	}, nil
}
