package providers

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/endpoints"
)

type Google struct {
	*oauth2.Config
}

func NewGoogleProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	google := &Google{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/google/callback",
			Scopes:       scopes,
			Endpoint:     endpoints.Google,
		},
	}

	return NewOauth2Provider(google)
}

type googleUser struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (g *Google) GetProfile(
	ctx context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	var user googleUser
	if err := fetchOAuthProfile(
		ctx,
		"https://www.googleapis.com/oauth2/v2/userinfo",
		accessToken,
		&user,
	); err != nil {
		return oidc.Profile{}, fmt.Errorf("Google API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: user.ID,
		Email:          user.Email,
		EmailVerified:  oidc.EmailVerificationFromBool(user.VerifiedEmail),
		Name:           user.Name,
		Picture:        user.Picture,
	}, nil
}

func appendAuthURLParam[T ~string](
	opts []oauth2.AuthCodeOption, key string, value *T,
) []oauth2.AuthCodeOption {
	if value == nil {
		return opts
	}

	return append(opts, oauth2.SetAuthURLParam(key, string(*value)))
}

func (g *Google) AuthCodeURL(
	state string,
	providerSpecificParams *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	if providerSpecificParams != nil {
		opts = appendAuthURLParam(opts, "prompt", providerSpecificParams.Prompt)
		opts = appendAuthURLParam(opts, "login_hint", providerSpecificParams.LoginHint)
		opts = appendAuthURLParam(opts, "hd", providerSpecificParams.Hd)
		opts = appendAuthURLParam(opts, "access_type", providerSpecificParams.AccessType)
		opts = appendAuthURLParam(
			opts,
			"include_granted_scopes",
			providerSpecificParams.IncludeGrantedScopes,
		)
		opts = appendAuthURLParam(opts, "hl", providerSpecificParams.Hl)
	}

	return g.Config.AuthCodeURL(state, opts...)
}
