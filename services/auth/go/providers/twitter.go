package providers

import (
	"context"
	"fmt"
	"net/url"

	"github.com/nhost/hasura-auth/go/oidc"
	"github.com/nhost/hasura-auth/go/providers/oauth1"
)

type Twitter struct {
	*oauth1.Config
}

func NewTwitterProvider(
	consumerKey, consumerSecret, authServerURL string,
) *Provider {
	authorizeURL, err := url.Parse("https://api.twitter.com/oauth/authorize")
	if err != nil {
		panic("invalid Twitter authorize URL: " + err.Error())
	}

	twitter := &Twitter{
		Config: &oauth1.Config{
			ConsumerKey:     consumerKey,
			ConsumerSecret:  consumerSecret,
			CallbackURL:     authServerURL + "/signin/provider/twitter/callback",
			AccessURL:       "https://api.twitter.com/oauth/access_token",
			RequestTokenURL: "https://api.twitter.com/oauth/request_token",
			AuthorizeURL:    authorizeURL,
		},
	}

	return NewOauth1Provider(twitter)
}

type twitterUser struct {
	ID              string `json:"id_str"`
	ScreenName      string `json:"screen_name"`
	Name            string `json:"name"`
	Email           string `json:"email"`
	ProfileImageURL string `json:"profile_image_url_https"`
}

func (t *Twitter) GetProfile(
	ctx context.Context,
	accessTokenValue string,
	accessTokenSecret string,
) (oidc.Profile, error) {
	var user twitterUser
	if err := t.GetJSON(ctx, oauth1.GetOptions{ //nolint:exhaustruct
		URL:         "https://api.twitter.com/1.1/account/verify_credentials.json",
		OAuthToken:  accessTokenValue,
		TokenSecret: accessTokenSecret,
		Params: map[string]string{
			"include_email": "true",
		},
	}, &user); err != nil {
		return oidc.Profile{}, fmt.Errorf("Twitter API error: %w", err)
	}

	return oidc.Profile{
		ProviderUserID: user.ID,
		Email:          user.Email,
		EmailVerified:  user.Email != "",
		Name:           user.Name,
		Picture:        user.ProfileImageURL,
	}, nil
}
