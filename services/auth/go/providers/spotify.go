package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

// Spotify represents a Spotify OAuth2 provider implementation.
// It embeds the standard oauth2.Config to handle OAuth2 authentication flow.
type Spotify struct {
	*oauth2.Config
}

// NewSpotifyProvider creates a new Spotify OAuth2 provider with the given configuration.
// It sets up the OAuth2 configuration with Spotify's authorization and token endpoints,
// and configures the redirect URL for the OAuth2 callback.
func NewSpotifyProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	redirectURL := authServerURL + "/signin/provider/spotify/callback"

	spotify := &Spotify{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://accounts.spotify.com/authorize",
				TokenURL: "https://accounts.spotify.com/api/token",
			},
		},
	}

	return NewOauth2Provider(spotify)
}

type spotifyImage struct {
	URL string `json:"url"`
}

type spotifyUserProfile struct {
	ID          string         `json:"id"`
	Email       string         `json:"email"`
	DisplayName string         `json:"display_name"`
	Images      []spotifyImage `json:"images"`
}

// GetProfile retrieves the user's profile information from Spotify using the provided access token.
// It returns an oidc.Profile containing the user's ID, name, email, and avatar URL.
// The method makes a request to Spotify's API to fetch the user's profile data.
func (s *Spotify) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile spotifyUserProfile

	if err := fetchOAuthProfile(
		ctx,
		"https://api.spotify.com/v1/me",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Spotify API error: %w", err)
	}

	var avatarURL string
	if len(userProfile.Images) > 0 {
		avatarURL = userProfile.Images[0].URL
	}

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Name:           userProfile.DisplayName,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Picture:        avatarURL,
	}, nil
}

func (s *Spotify) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return s.Config.AuthCodeURL(state, opts...)
}
