package providers

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
)

type Github struct {
	profileURL string
	*oauth2.Config
}

func NewGithubProvider(
	clientID, clientSecret, authServerURL string,
	authURL, tokenURL, profileURL string,
	scopes []string,
) *Provider {
	github := &Github{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/github/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  authURL,
				TokenURL: tokenURL,
			},
		},
		profileURL: profileURL,
	}

	return NewOauth2Provider(github)
}

type gitHubUser struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

type gitHubEmail []struct {
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
}

func (g *Github) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var user gitHubUser
	if err := fetchOAuthProfile(
		ctx,
		g.profileURL,
		accessToken,
		&user,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("GitHub API error: %w", err)
	}

	var emails gitHubEmail
	if err := fetchOAuthProfile(
		ctx,
		"https://api.github.com/user/emails",
		accessToken,
		&emails,
		WithHeaders(map[string]string{"Accept": "application/json"}),
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("GitHub API error: %w", err)
	}

	if len(emails) == 0 {
		return oidc.Profile{}, errors.New("GitHub user has no email addresses") //nolint:goerr113
	}

	return oidc.Profile{
		ProviderUserID: strconv.Itoa(user.ID),
		Email:          emails[0].Email,
		EmailVerified:  emails[0].Verified,
		Name:           user.Name,
		Picture:        user.AvatarURL,
	}, nil
}
