package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

var ErrNoConfirmedBitbucketEmail = errors.New("no confirmed Bitbucket email found")

type Bitbucket struct {
	*oauth2.Config
}

func NewBitbucketProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	bitbucket := &Bitbucket{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/bitbucket/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://bitbucket.org/site/oauth2/authorize",
				TokenURL: "https://bitbucket.org/site/oauth2/access_token",
			},
		},
	}

	return NewOauth2Provider(bitbucket)
}

type bitbucketAPIUser struct {
	UUID        string `json:"uuid"`
	DisplayName string `json:"display_name"`
	Links       struct {
		Avatar struct {
			Href string `json:"href"`
		} `json:"avatar"`
	} `json:"links"`
}

type bitbucketEmailEntry struct {
	Email       string `json:"email"`
	IsConfirmed bool   `json:"is_confirmed"`
}

type bitbucketEmailsResponse struct {
	Values []bitbucketEmailEntry `json:"values"`
}

func (b *Bitbucket) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	// Step 1: Get user profile from Bitbucket
	var user bitbucketAPIUser
	if err := fetchOAuthProfile(ctx, "https://api.bitbucket.org/2.0/user", accessToken, &user); err != nil {
		return oidc.Profile{}, fmt.Errorf("Bitbucket user profile error: %w", err)
	}

	// Note: Bitbucket's /user endpoint does not return the user's email address.
	// To retrieve the email, we must make a separate request to /user/emails.
	// See: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-users/#api-user-emails-get

	// Step 2: Get email
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://api.bitbucket.org/2.0/user/emails",
		nil,
	)
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("Bitbucket email request error: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("Bitbucket email fetch error: %w", err)
	}
	defer resp.Body.Close()

	var emailResp bitbucketEmailsResponse
	if err := json.NewDecoder(resp.Body).Decode(&emailResp); err != nil {
		return oidc.Profile{}, fmt.Errorf("Bitbucket email decode error: %w", err)
	}

	// Pick the first verified email
	var (
		primaryEmail  string
		fallbackEmail string
	)

	for _, e := range emailResp.Values {
		if e.IsConfirmed {
			primaryEmail = e.Email
			break
		} else if fallbackEmail == "" {
			fallbackEmail = e.Email
		}
	}

	if primaryEmail == "" {
		if fallbackEmail == "" {
			return oidc.Profile{}, ErrNoConfirmedBitbucketEmail
		}

		primaryEmail = fallbackEmail
	}

	// Step 3: Return profile
	return oidc.Profile{
		ProviderUserID: user.UUID,
		Email:          primaryEmail,
		EmailVerified:  primaryEmail != "",
		Name:           user.DisplayName,
		Picture:        user.Links.Avatar.Href,
	}, nil
}

func (b *Bitbucket) AuthCodeURL(
	state string,
	_ *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	return b.Config.AuthCodeURL(state, opts...)
}
