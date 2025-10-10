package providers

import (
	"context"
	"fmt"
	"strconv"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type Gitlab struct {
	*oauth2.Config
}

func NewGitlabProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	gitlab := &Gitlab{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/gitlab/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://gitlab.com/oauth/authorize",
				TokenURL: "https://gitlab.com/oauth/token",
			},
		},
	}

	return NewOauth2Provider(gitlab)
}

type gitlabUserProfile struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

func (l *Gitlab) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile gitlabUserProfile
	if err := fetchOAuthProfile(
		ctx,
		"https://gitlab.com/api/v4/user",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("GitLab API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: strconv.Itoa(userProfile.ID),
		Name:           userProfile.Name,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Picture:        userProfile.AvatarURL,
	}, nil
}
