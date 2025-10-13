package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type LinkedIn struct {
	*oauth2.Config
}

func NewLinkedInProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	linkedin := &LinkedIn{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/linkedin/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://www.linkedin.com/oauth/v2/authorization",
				TokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
			},
		},
	}

	return NewOauth2Provider(linkedin)
}

type linkedInUserInfoProfile struct {
	ID         string `json:"sub"`
	Email      string `json:"email"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
	Picture    string `json:"picture"`
}

func (l *LinkedIn) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile linkedInUserInfoProfile
	if err := fetchOAuthProfile(
		ctx,
		"https://api.linkedin.com/v2/userinfo",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("LinkedIn API error: %w", err)
	}

	// Construct the full name
	name := userProfile.GivenName
	if userProfile.FamilyName != "" {
		if name != "" {
			name += " "
		}

		name += userProfile.FamilyName
	}

	// If there's no name but there's an email, use email as the name
	if name == "" && userProfile.Email != "" {
		name = userProfile.Email
	}

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Email:          userProfile.Email,
		EmailVerified:  userProfile.Email != "",
		Name:           name,
		Picture:        userProfile.Picture,
	}, nil
}
