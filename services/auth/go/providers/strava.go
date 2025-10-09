package providers

import (
	"context"
	"fmt"
	"strconv"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type Strava struct {
	*oauth2.Config
}

func NewStravaProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	strava := &Strava{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/strava/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://www.strava.com/api/v3/oauth/authorize",
				TokenURL: "https://www.strava.com/api/v3/oauth/token",
			},
		},
	}

	return NewOauth2Provider(strava)
}

func (s *Strava) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	opts = append(opts, oauth2.SetAuthURLParam("approval_prompt", "force"))
	return s.Config.AuthCodeURL(state, opts...)
}

type stravaAthlete struct {
	ID            int    `json:"id"`
	Username      string `json:"username"`
	Firstname     string `json:"firstname"`
	Lastname      string `json:"lastname"`
	ProfileMedium string `json:"profile_medium"`
}

func (s *Strava) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var athlete stravaAthlete
	if err := fetchOAuthProfile(
		ctx,
		"https://www.strava.com/api/v3/athlete",
		accessToken,
		&athlete,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Strava API error: %w", err)
	}

	// Email intentionally left out, and not marked verified
	return oidc.Profile{
		ProviderUserID: strconv.Itoa(athlete.ID),
		Name:           athlete.Firstname + " " + athlete.Lastname,
		Picture:        athlete.ProfileMedium,
		Email:          "",
		EmailVerified:  false,
	}, nil
}
