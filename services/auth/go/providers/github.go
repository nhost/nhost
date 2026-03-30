package providers

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type Github struct {
	*oauth2.Config

	profileURL string
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

type gitHubEmailEntry struct {
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
	Primary  bool   `json:"primary"`
}

type gitHubEmail []gitHubEmailEntry

// selectEmail picks the best email from a GitHub user's email list.
// Priority: primary+verified > first verified > first email.
func selectEmail(emails gitHubEmail) gitHubEmailEntry {
	selected := emails[0]
	primarySeen := false

	for _, e := range emails {
		if e.Primary && e.Verified {
			return e
		}

		if e.Primary {
			primarySeen = true
		}

		if e.Verified && !selected.Verified {
			selected = e
		}

		if selected.Verified && primarySeen {
			break
		}
	}

	return selected
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
		return oidc.Profile{}, errors.New("GitHub user has no email addresses") //nolint:err113
	}

	selected := selectEmail(emails)

	return oidc.Profile{
		ProviderUserID: strconv.Itoa(user.ID),
		Email:          selected.Email,
		EmailVerified:  selected.Verified,
		Name:           user.Name,
		Picture:        user.AvatarURL,
	}, nil
}

func (g *Github) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return g.Config.AuthCodeURL(state, opts...)
}
