package cmd

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
)

//nolint:cyclop
func getDefaultScopes(providerName api.SignInProvider) []string {
	switch providerName {
	case api.SignInProviderGoogle:
		return providers.DefaultGoogleScopes
	case api.SignInProviderDiscord:
		return providers.DefaultDiscordScopes
	case api.SignInProviderGithub:
		return providers.DefaultGithubScopes
	case api.SignInProviderApple:
		return providers.DefaultAppleScopes
	case api.SignInProviderLinkedin:
		return providers.DefaultLinkedInScopes
	case api.SignInProviderSpotify:
		return providers.DefaultSpotifyScopes
	case api.SignInProviderTwitch:
		return providers.DefaultTwitchScopes
	case api.SignInProviderGitlab:
		return providers.DefaultGitlabScopes
	case api.SignInProviderBitbucket:
		return providers.DefaultBitbucketScopes
	case api.SignInProviderWorkos:
		return providers.DefaultWorkOSScopes
	case api.SignInProviderAzuread:
		return providers.DefaultAzureadScopes
	case api.SignInProviderEntraid:
		return providers.DefaultEntraIDScopes
	case api.SignInProviderFacebook:
		return providers.DefaultFacebookScopes
	case api.SignInProviderWindowslive:
		return providers.DefaultWindowsliveScopes
	case api.SignInProviderStrava:
		return providers.DefaultStravaScopes
	case api.SignInProviderTwitter:
		return []string{}
	default:
		panic("Unknown OAuth2 provider: " + providerName)
	}
}

func getScopes(provider api.SignInProvider, scopes []string) []string {
	// clean the scopes in case of empty string
	var cleanedScopes []string

	for _, scope := range scopes {
		if scope != "" {
			cleanedScopes = append(cleanedScopes, scope)
		}
	}

	if len(cleanedScopes) > 0 {
		return cleanedScopes
	}

	return getDefaultScopes(provider)
}

//nolint:funlen,cyclop
func getOauth2Providers(
	ctx context.Context,
	opts Options,
	logger *slog.Logger,
) (providers.Map, error) {
	providersMap := make(providers.Map)

	if opts.Providers.Google.Enabled {
		providersMap["google"] = providers.NewGoogleProvider(
			opts.Providers.Google.ClientID,
			opts.Providers.Google.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderGoogle, opts.Providers.Google.Scope),
		)
	}

	if opts.Providers.Github.Enabled {
		providersMap["github"] = providers.NewGithubProvider(
			opts.Providers.Github.ClientID,
			opts.Providers.Github.ClientSecret,
			opts.ServerURL,
			opts.Providers.Github.AuthorizationURL,
			opts.Providers.Github.TokenURL,
			opts.Providers.Github.UserProfileURL,
			getScopes(api.SignInProviderGithub, opts.Providers.Github.Scope),
		)
	}

	if opts.Providers.Apple.Enabled {
		clientSecret, err := providers.GenerateClientSecret(
			opts.Providers.Apple.TeamID,
			opts.Providers.Apple.KeyID,
			opts.Providers.Apple.ClientID,
			opts.Providers.Apple.PrivateKey,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Apple client secret: %w", err)
		}

		providersMap["apple"], err = providers.NewAppleProvider(
			ctx,
			opts.Providers.Apple.ClientID,
			clientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderApple, opts.Providers.Apple.Scope),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple provider: %w", err)
		}
	}

	if opts.Providers.LinkedIn.Enabled {
		providersMap["linkedin"] = providers.NewLinkedInProvider(
			opts.Providers.LinkedIn.ClientID,
			opts.Providers.LinkedIn.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderLinkedin, opts.Providers.LinkedIn.Scope),
		)
	}

	if opts.Providers.Discord.Enabled {
		providersMap["discord"] = providers.NewDiscordProvider(
			opts.Providers.Discord.ClientID,
			opts.Providers.Discord.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderDiscord, opts.Providers.Discord.Scope),
		)
	}

	if opts.Providers.Spotify.Enabled {
		providersMap["spotify"] = providers.NewSpotifyProvider(
			opts.Providers.Spotify.ClientID,
			opts.Providers.Spotify.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderSpotify, opts.Providers.Spotify.Scope),
		)
	}

	if opts.Providers.Twitch.Enabled {
		providersMap["twitch"] = providers.NewTwitchProvider(
			opts.Providers.Twitch.ClientID,
			opts.Providers.Twitch.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderTwitch, opts.Providers.Twitch.Scope),
		)
	}

	if opts.Providers.Gitlab.Enabled {
		providersMap["gitlab"] = providers.NewGitlabProvider(
			opts.Providers.Gitlab.ClientID,
			opts.Providers.Gitlab.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderGitlab, opts.Providers.Gitlab.Scope),
		)
	}

	if opts.Providers.Bitbucket.Enabled {
		providersMap["bitbucket"] = providers.NewBitbucketProvider(
			opts.Providers.Bitbucket.ClientID,
			opts.Providers.Bitbucket.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderBitbucket, opts.Providers.Bitbucket.Scope),
		)
	}

	if opts.Providers.Workos.Enabled {
		providersMap["workos"] = providers.NewWorkosProvider(
			opts.Providers.Workos.ClientID,
			opts.Providers.Workos.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderWorkos, opts.Providers.Workos.Scope),
			opts.Providers.Workos.DefaultOrganization,
			opts.Providers.Workos.DefaultConnection,
			opts.Providers.Workos.DefaultDomain,
		)
	}

	if opts.Providers.Azuread.Enabled {
		logger.WarnContext(
			ctx, "AzureAD provider is deprecated, use EntraID provider instead",
		)

		providersMap["azuread"] = providers.NewAzureadProvider(
			opts.Providers.Azuread.ClientID,
			opts.Providers.Azuread.ClientSecret,
			opts.ServerURL,
			opts.Providers.Azuread.Tenant,
			getScopes(api.SignInProviderAzuread, opts.Providers.Azuread.Scope),
		)
	}

	if opts.Providers.EntraID.Enabled {
		providersMap["entraid"] = providers.NewEntraIDProvider(
			opts.Providers.EntraID.ClientID,
			opts.Providers.EntraID.ClientSecret,
			opts.ServerURL,
			opts.Providers.EntraID.Tenant,
			getScopes(api.SignInProviderEntraid, opts.Providers.EntraID.Scope),
		)
	}

	if opts.Providers.Facebook.Enabled {
		providersMap["facebook"] = providers.NewFacebookProvider(
			opts.Providers.Facebook.ClientID,
			opts.Providers.Facebook.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderFacebook, opts.Providers.Facebook.Scope),
		)
	}

	if opts.Providers.Windowslive.Enabled {
		providersMap["windowslive"] = providers.NewWindowsliveProvider(
			opts.Providers.Windowslive.ClientID,
			opts.Providers.Windowslive.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderWindowslive, opts.Providers.Windowslive.Scope),
		)
	}

	if opts.Providers.Strava.Enabled {
		providersMap["strava"] = providers.NewStravaProvider(
			opts.Providers.Strava.ClientID,
			opts.Providers.Strava.ClientSecret,
			opts.ServerURL,
			getScopes(api.SignInProviderStrava, opts.Providers.Strava.Scope),
		)
	}

	if opts.Providers.Twitter.Enabled {
		providersMap["twitter"] = providers.NewTwitterProvider(
			opts.Providers.Twitter.ConsumerKey,
			opts.Providers.Twitter.ConsumerSecret,
			opts.ServerURL,
		)
	}

	return providersMap, nil
}
