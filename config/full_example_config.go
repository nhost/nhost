package config

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/cli/internal/generichelper"
	"github.com/nhost/cli/internal/ports"
)

func FullExampleConfig() ([]byte, error) {
	s, err := schema.New()
	if err != nil {
		return nil, err
	}

	c, _, err := DefaultConfigAndSecrets()
	if err != nil {
		return nil, fmt.Errorf("failed to generate default config: %w", err)
	}

	c, err = s.Fill(c)
	if err != nil {
		return nil, err
	}

	exampleResources := &model.ConfigResources{
		Compute: &model.ConfigResourcesCompute{
			Cpu:    500,
			Memory: 1024,
		},
		Replicas: 1,
	}

	env := c.GetGlobal().GetEnvironment()
	env = append(
		env,
		&model.ConfigEnvironmentVariable{Name: "STRIPE_SECRET_KEY", Value: "{{ secrets.stripe_secret_key }}"},
	)
	c.GetGlobal().Environment = env

	c.GetHasura().Resources = exampleResources

	c.GetAuth().GetRedirections().AllowedUrls = []string{"https://example.com"}
	c.GetAuth().GetUser().Email = &model.ConfigAuthUserEmail{
		Allowed: []string{"allowed@person.com"},
		Blocked: []string{"blocked@person.com"},
	}
	c.GetAuth().GetUser().EmailDomains = &model.ConfigAuthUserEmailDomains{
		Allowed: []string{"allowed.com"},
		Blocked: []string{"blocked.com"},
	}
	c.GetAuth().GetSession().GetAccessToken().CustomClaims = []*model.ConfigAuthsessionaccessTokenCustomClaims{
		{
			Key:   "aaabbbccc",
			Value: "vvv",
		},
	}

	c.GetAuth().GetMethod().GetOauth().Apple = &model.ConfigAuthMethodOauthApple{
		Enabled:    generichelper.Pointerify(false),
		ClientId:   generichelper.Pointerify("client-id"),
		KeyId:      generichelper.Pointerify("key-id"),
		TeamId:     generichelper.Pointerify("team-id"),
		Scope:      []string{"email", "name"},
		PrivateKey: generichelper.Pointerify("private-key"),
	}

	c.GetAuth().GetMethod().GetOauth().Azuread = &model.ConfigAuthMethodOauthAzuread{
		Enabled:      generichelper.Pointerify(false),
		Tenant:       generichelper.Pointerify("common"),
		ClientId:     generichelper.Pointerify("client-id"),
		ClientSecret: generichelper.Pointerify("client-secret"),
	}

	standardOauthProviderWithScopeExample := &model.ConfigStandardOauthProviderWithScope{
		Enabled:      generichelper.Pointerify(false),
		ClientId:     generichelper.Pointerify("client-id"),
		Scope:        []string{"scope1", "scope2"},
		ClientSecret: generichelper.Pointerify("client-secret"),
	}

	c.GetAuth().Resources = exampleResources
	c.GetAuth().GetMethod().GetOauth().Bitbucket = &model.ConfigStandardOauthProvider{
		Enabled:      generichelper.Pointerify(false),
		ClientId:     generichelper.Pointerify("client-id"),
		ClientSecret: generichelper.Pointerify("client-secret"),
	}

	c.GetAuth().GetMethod().GetOauth().Discord = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Facebook = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Github = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Gitlab = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Google = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Linkedin = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Spotify = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Strava = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Twitch = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Twitter = &model.ConfigAuthMethodOauthTwitter{
		Enabled:        generichelper.Pointerify(false),
		ConsumerKey:    generichelper.Pointerify("key"),
		ConsumerSecret: generichelper.Pointerify("secret"),
	}
	c.GetAuth().GetMethod().GetOauth().Windowslive = standardOauthProviderWithScopeExample
	c.GetAuth().GetMethod().GetOauth().Workos = &model.ConfigAuthMethodOauthWorkos{
		Connection:   generichelper.Pointerify("workos-connection"),
		Organization: generichelper.Pointerify("workos-org"),
		Enabled:      generichelper.Pointerify(false),
		ClientId:     generichelper.Pointerify("client-id"),
		ClientSecret: generichelper.Pointerify("client-secret"),
	}

	c.GetAuth().GetMethod().GetWebauthn().RelyingParty = &model.ConfigAuthMethodWebauthnRelyingParty{
		Name:    generichelper.Pointerify("party-name"),
		Origins: []string{"https://example.com"},
	}

	c.GetAuth().GetTotp().Issuer = generichelper.Pointerify("issuer")

	c.GetPostgres().Resources = exampleResources

	c.Provider = &model.ConfigProvider{
		Smtp: &model.ConfigSmtp{
			User:     "user",
			Password: "password",
			Sender:   "hasura-auth@example.com",
			Host:     "mailhog",
			Port:     uint16(ports.DefaultSMTPPort),
			Secure:   false,
			Method:   "PLAIN",
		},
		Sms: &model.ConfigSms{
			Provider:           generichelper.Pointerify("twilio"),
			AccountSid:         "account-sid",
			AuthToken:          "auth-token",
			MessagingServiceId: "messaging-service-id",
		},
	}

	c.GetStorage().Resources = exampleResources

	if err = s.ValidateConfig(c); err != nil {
		return nil, err
	}

	return MarshalFunc(c)
}
