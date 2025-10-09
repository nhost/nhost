package providers

import (
	"context"
	"fmt"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
)

type Facebook struct {
	*oauth2.Config
}

func NewFacebookProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	facebook := &Facebook{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/facebook/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://www.facebook.com/v22.0/dialog/oauth",
				TokenURL: "https://graph.facebook.com/v22.0/oauth/access_token",
			},
		},
	}

	return NewOauth2Provider(facebook)
}

type FacebookUserProfile struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	} `json:"picture"`
}

func (t *Facebook) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile FacebookUserProfile
	if err := fetchOAuthProfile(
		ctx,
		"https://graph.facebook.com/me?fields=id,name,email,picture",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Facebook API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Name:           userProfile.Name,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Picture:        userProfile.Picture.Data.URL,
	}, nil
}
