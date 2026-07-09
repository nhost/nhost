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

func (g *Google) AuthCodeURL(
	state string,
	providerSpecificParams *api.ProviderSpecificParams,
	opts ...oauth2.AuthCodeOption,
) string {
	if providerSpecificParams != nil {
		if providerSpecificParams.Prompt != nil {
			opts = append(
				opts,
				oauth2.SetAuthURLParam("prompt", string(*providerSpecificParams.Prompt)),
			)
		}

		if providerSpecificParams.LoginHint != nil {
			opts = append(
				opts,
				oauth2.SetAuthURLParam("login_hint", *providerSpecificParams.LoginHint),
			)
		}

		if providerSpecificParams.Hd != nil {
			opts = append(opts, oauth2.SetAuthURLParam("hd", *providerSpecificParams.Hd))
		}

		if providerSpecificParams.AccessType != nil {
			opts = append(
				opts,
				oauth2.SetAuthURLParam("access_type", string(*providerSpecificParams.AccessType)),
			)
		}

		if providerSpecificParams.IncludeGrantedScopes != nil {
			opts = append(
				opts,
				oauth2.SetAuthURLParam(
					"include_granted_scopes",
					string(*providerSpecificParams.IncludeGrantedScopes),
				),
			)
		}

		if providerSpecificParams.Hl != nil {
			opts = append(opts, oauth2.SetAuthURLParam("hl", *providerSpecificParams.Hl))
		}
	}

	return g.Config.AuthCodeURL(state, opts...)
}
