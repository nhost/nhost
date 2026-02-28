package providers

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

var ErrNoUserDataFound = errors.New("no user data found")

type Twitch struct {
	*oauth2.Config
}

func NewTwitchProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	twitch := &Twitch{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/twitch/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://id.twitch.tv/oauth2/authorize",
				TokenURL: "https://id.twitch.tv/oauth2/token",
			},
		},
	}

	return NewOauth2Provider(twitch)
}

type twitchUser struct {
	ID              string `json:"id"`
	DisplayName     string `json:"display_name"`
	Email           string `json:"email"`
	ProfileImageURL string `json:"profile_image_url"`
}

type twitchUserResponse struct {
	Data []twitchUser `json:"data"`
}

func (t *Twitch) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var response twitchUserResponse

	err := fetchOAuthProfile(
		ctx,
		"https://api.twitch.tv/helix/users",
		accessToken,
		&response,
		WithHeaders(map[string]string{
			"Client-Id": t.ClientID,
		}),
	)
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to fetch profile: %w", err)
	}

	if len(response.Data) == 0 {
		return oidc.Profile{}, ErrNoUserDataFound
	}

	userProfile := response.Data[0]

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Name:           userProfile.DisplayName,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Picture:        userProfile.ProfileImageURL,
	}, nil
}

func (t *Twitch) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return t.Config.AuthCodeURL(state, opts...)
}
