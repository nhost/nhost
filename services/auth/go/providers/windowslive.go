package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type WindowsLive struct {
	*oauth2.Config
}

func NewWindowsliveProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	windowsLive := &WindowsLive{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/windowslive/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://login.live.com/oauth20_authorize.srf",
				TokenURL: "https://login.live.com/oauth20_token.srf",
			},
		},
	}

	return NewOauth2Provider(windowsLive)
}

type microsoftProfile struct {
	Emails          Emails `json:"emails"`
	FirstName       string `json:"first_name"`
	Gender          any    `json:"gender"`
	ID              string `json:"id"`
	LastName        string `json:"last_name"`
	Link            string `json:"link"`
	Locale          string `json:"locale"`
	Name            string `json:"name"`
	ProfileImageURL string `json:"profile_image_url"`
}

type Emails struct {
	Account   string `json:"account"`
	Business  any    `json:"business"`
	Personal  any    `json:"personal"`
	Preferred string `json:"preferred"`
}

func (w *WindowsLive) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var profile microsoftProfile
	if err := fetchOAuthProfile(
		ctx,
		"https://apis.live.net/v5.0/me",
		accessToken,
		&profile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("microsoft graph api error: %w", err)
	}

	email := profile.Emails.Preferred
	if email == "" {
		email = profile.Emails.Account
	}

	return oidc.Profile{
		ProviderUserID: profile.ID,
		Name:           profile.Name + " " + profile.LastName,
		Email:          email,
		EmailVerified:  email != "",
		Picture:        profile.ProfileImageURL,
	}, nil
}

func (w *WindowsLive) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return w.Config.AuthCodeURL(state, opts...)
}
