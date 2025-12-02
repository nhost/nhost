package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type Discord struct {
	*oauth2.Config
}

func NewDiscordProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	discord := &Discord{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/discord/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://discord.com/api/oauth2/authorize",
				TokenURL: "https://discord.com/api/oauth2/token",
			},
		},
	}

	return NewOauth2Provider(discord)
}

type discordUserProfile struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	Discriminator string `json:"discriminator"`
	Email         string `json:"email"`
	Locale        string `json:"locale"`
	Avatar        string `json:"avatar"`
}

func (d *Discord) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile discordUserProfile
	if err := fetchOAuthProfile(
		ctx,
		"https://discord.com/api/users/@me",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Discord API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Name:           fmt.Sprintf("%s#%s", userProfile.Username, userProfile.Discriminator),
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Picture: fmt.Sprintf(
			"https://cdn.discordapp.com/avatars/%s/%s.png",
			userProfile.ID,
			userProfile.Avatar,
		),
	}, nil
}

func (d *Discord) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return d.Config.AuthCodeURL(state, opts...)
}
