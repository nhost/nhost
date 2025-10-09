package providers

import (
	"context"
	"fmt"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
)

const workOSAPIBaseURL = "https://api.workos.com"

type oauth2ConfigWrapper struct {
	*oauth2.Config

	parent *WorkOS
}

func (w *oauth2ConfigWrapper) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	if w.parent.DefaultOrganization != "" {
		opts = append(opts, oauth2.SetAuthURLParam("organization", w.parent.DefaultOrganization))
	}

	if w.parent.DefaultConnection != "" {
		opts = append(opts, oauth2.SetAuthURLParam("connection", w.parent.DefaultConnection))
	}

	if w.parent.DefaultDomain != "" {
		opts = append(opts, oauth2.SetAuthURLParam("domain", w.parent.DefaultDomain))
	}

	finalURL := w.Config.AuthCodeURL(state, opts...)

	return finalURL
}

type WorkOS struct {
	*oauth2ConfigWrapper

	DefaultOrganization string
	DefaultConnection   string
	DefaultDomain       string
}

func NewWorkosProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
	defaultOrganization, defaultConnection, defaultDomain string,
) *Provider {
	redirectURL := authServerURL + "/signin/provider/workos/callback"

	baseConfig := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       scopes,
		Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
			AuthURL:  workOSAPIBaseURL + "/sso/authorize",
			TokenURL: workOSAPIBaseURL + "/sso/token",
		},
	}

	w := &WorkOS{ //nolint:exhaustruct
		DefaultOrganization: defaultOrganization,
		DefaultConnection:   defaultConnection,
		DefaultDomain:       defaultDomain,
	}

	w.oauth2ConfigWrapper = &oauth2ConfigWrapper{
		Config: baseConfig,
		parent: w,
	}

	return NewOauth2Provider(w)
}

type WorkosUserProfile struct {
	ID            string         `json:"id"`
	Email         string         `json:"email"`
	FirstName     string         `json:"first_name"`
	LastName      string         `json:"last_name"`
	Locale        string         `json:"locale"`
	RawAttributes map[string]any `json:"raw_attributes"`
}

func (w *WorkOS) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var userProfile WorkosUserProfile

	if err := fetchOAuthProfile(
		ctx,
		workOSAPIBaseURL+"/sso/profile",
		accessToken,
		&userProfile,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("WorkOS API Error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: userProfile.ID,
		Email:          userProfile.Email,
		Name:           userProfile.FirstName + " " + userProfile.LastName,
		Picture:        "",
		EmailVerified:  userProfile.Email != "",
	}, nil
}
