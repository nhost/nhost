package providers

import (
	"context"
	"errors"

	"github.com/nhost/hasura-auth/go/oidc"
	"golang.org/x/oauth2"
)

type FakeProvider struct {
	*oauth2.Config
}

func NewFakeProvider(
	clientID, clientSecret, authServerURL string,
	scopes []string,
) *Provider {
	fake := &FakeProvider{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/fake/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:       "https://accounts.fake.com/o/oauth2/auth",
				TokenURL:      "https://oauth2.fake.com/token",
				DeviceAuthURL: "https://oauth2.fake.com/device/code",
			},
		},
	}

	return NewOauth2Provider(fake)
}

func (f *FakeProvider) Oauth2() *oauth2.Config {
	return f.Config
}

func (f *FakeProvider) Exchange(
	_ context.Context, code string, _ ...oauth2.AuthCodeOption,
) (*oauth2.Token, error) {
	switch code {
	case "valid-code-1":
		return &oauth2.Token{ //nolint:exhaustruct
			AccessToken: "valid-accesstoken-1",
			TokenType:   "Bearer",
		}, nil
	case "valid-code-empty-email":
		return &oauth2.Token{ //nolint:exhaustruct
			AccessToken: "valid-accesstoken-empty-email",
			TokenType:   "Bearer",
		}, nil
	default:
		return nil, errors.New("invalid code") //nolint:err113
	}
}

func (f *FakeProvider) GetProfile(
	_ context.Context,
	accessToken string,
	_ *string,
	_ map[string]any,
) (oidc.Profile, error) {
	switch accessToken {
	case "valid-accesstoken-1":
		return oidc.Profile{
			ProviderUserID: "1234567890",
			Email:          "user1@fake.com",
			EmailVerified:  true,
			Name:           "User One",
			Picture:        "https://fake.com/images/profile/user1.jpg",
		}, nil
	case "valid-accesstoken-empty-email":
		return oidc.Profile{
			ProviderUserID: "9876543210",
			Email:          "",
			EmailVerified:  false,
			Name:           "User No Email",
			Picture:        "https://fake.com/images/profile/user2.jpg",
		}, nil
	default:
		return oidc.Profile{}, errors.New("invalid access token") //nolint:err113
	}
}
