package providers

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

type Oauth2Provider interface {
	AuthCodeURL(
		state string,
		providerSpecificParams *api.ProviderSpecificParams,
		opts ...oauth2.AuthCodeOption,
	) string
	Exchange(ctx context.Context, code string, opts ...oauth2.AuthCodeOption) (*oauth2.Token, error)
	GetProfile(
		ctx context.Context,
		code string,
		idToken *string,
		extra map[string]any,
	) (oidc.Profile, error)
}

type Oauth1Provider interface {
	AuthCodeURL(ctx context.Context, state string) (string, error)
	AccessToken(ctx context.Context, requestToken, verifier string) (string, string, error)
	GetProfile(
		ctx context.Context,
		accessTokenValue string,
		accessTokenSecret string,
	) (oidc.Profile, error)
}

type Provider struct {
	oauth1 Oauth1Provider
	oauth2 Oauth2Provider
}

func NewOauth1Provider(oauth1 Oauth1Provider) *Provider {
	return &Provider{
		oauth1: oauth1,
		oauth2: nil,
	}
}

func NewOauth2Provider(oauth2 Oauth2Provider) *Provider {
	return &Provider{
		oauth1: nil,
		oauth2: oauth2,
	}
}

func (p *Provider) IsOauth1() bool {
	return p.oauth1 != nil
}

func (p *Provider) IsOauth2() bool {
	return p.oauth2 != nil
}

func (p *Provider) Oauth1() Oauth1Provider { //nolint:ireturn
	if p.oauth1 == nil {
		panic("provider is not an Oauth1 provider")
	}

	return p.oauth1
}

func (p *Provider) Oauth2() Oauth2Provider { //nolint:ireturn
	if p.oauth2 == nil {
		panic("provider is not an Oauth2 provider")
	}

	return p.oauth2
}

type Map map[string]*Provider

func (m Map) Get(name string) *Provider {
	if provider, ok := m[name]; ok {
		return provider
	}

	return nil
}
