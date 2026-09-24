package cmd

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/urfave/cli/v3"
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
	cmd *cli.Command,
	logger *slog.Logger,
) (providers.Map, error) {
	providersMap := make(providers.Map)

	if cmd.Bool(flagGoogleEnabled) {
		providersMap["google"] = providers.NewGoogleProvider(
			cmd.String(flagGoogleClientID),
			cmd.String(flagGoogleClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderGoogle, cmd.StringSlice(flagGoogleScope)),
		)
	}

	if cmd.Bool(flagGithubEnabled) {
		providersMap["github"] = providers.NewGithubProvider(
			cmd.String(flagGithubClientID),
			cmd.String(flagGithubClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagGithubAuthorizationURL),
			cmd.String(flagGithubTokenURL),
			cmd.String(flagGithubUserProfileURL),
			getScopes(api.SignInProviderGithub, cmd.StringSlice(flagGithubScope)),
		)
	}

	if cmd.Bool(flagAppleEnabled) {
		clientSecret, err := providers.GenerateClientSecret(
			cmd.String(flagAppleTeamID),
			cmd.String(flagAppleKeyID),
			cmd.String(flagAppleClientID),
			cmd.String(flagApplePrivateKey),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Apple client secret: %w", err)
		}

		providersMap["apple"], err = providers.NewAppleProvider(
			ctx,
			cmd.String(flagAppleClientID),
			clientSecret,
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderApple, cmd.StringSlice(flagAppleScope)),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple provider: %w", err)
		}
	}

	if cmd.Bool(flagLinkedInEnabled) {
		providersMap["linkedin"] = providers.NewLinkedInProvider(
			cmd.String(flagLinkedInClientID),
			cmd.String(flagLinkedInClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderLinkedin, cmd.StringSlice(flagLinkedInScope)),
		)
	}

	if cmd.Bool(flagDiscordEnabled) {
		providersMap["discord"] = providers.NewDiscordProvider(
			cmd.String(flagDiscordClientID),
			cmd.String(flagDiscordClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderDiscord, cmd.StringSlice(flagDiscordScope)),
		)
	}

	if cmd.Bool(flagSpotifyEnabled) {
		providersMap["spotify"] = providers.NewSpotifyProvider(
			cmd.String(flagSpotifyClientID),
			cmd.String(flagSpotifyClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderSpotify, cmd.StringSlice(flagSpotifyScope)),
		)
	}

	if cmd.Bool(flagTwitchEnabled) {
		providersMap["twitch"] = providers.NewTwitchProvider(
			cmd.String(flagTwitchClientID),
			cmd.String(flagTwitchClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderTwitch, cmd.StringSlice(flagTwitchScope)),
		)
	}

	if cmd.Bool(flagGitlabEnabled) {
		providersMap["gitlab"] = providers.NewGitlabProvider(
			cmd.String(flagGitlabClientID),
			cmd.String(flagGitlabClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderGitlab, cmd.StringSlice(flagGitlabScope)),
		)
	}

	if cmd.Bool(flagBitbucketEnabled) {
		providersMap["bitbucket"] = providers.NewBitbucketProvider(
			cmd.String(flagBitbucketClientID),
			cmd.String(flagBitbucketClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderBitbucket, cmd.StringSlice(flagBitbucketScope)),
		)
	}

	if cmd.Bool(flagWorkosEnabled) {
		providersMap["workos"] = providers.NewWorkosProvider(
			cmd.String(flagWorkosClientID),
			cmd.String(flagWorkosClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderWorkos, cmd.StringSlice(flagWorkosScope)),
			cmd.String(flagWorkosDefaultOrganization),
			cmd.String(flagWorkosDefaultConnection),
			cmd.String(flagWorkosDefaultDomain),
		)
	}

	if cmd.Bool(flagAzureadEnabled) {
		logger.WarnContext(
			ctx, "AzureAD provider is deprecated, use EntraID provider instead",
		)

		providersMap["azuread"] = providers.NewAzureadProvider(
			cmd.String(flagAzureadClientID),
			cmd.String(flagAzureadClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagAzureadTenant),
			getScopes(api.SignInProviderAzuread, cmd.StringSlice(flagAzureadScope)),
		)
	}

	if cmd.Bool(flagEntraIDEnabled) {
		providersMap["entraid"] = providers.NewEntraIDProvider(
			cmd.String(flagEntraIDClientID),
			cmd.String(flagEntraIDClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagEntraIDTenant),
			getScopes(api.SignInProviderEntraid, cmd.StringSlice(flagEntraIDScope)),
		)
	}

	if cmd.Bool(flagFacebookEnabled) {
		providersMap["facebook"] = providers.NewFacebookProvider(
			cmd.String(flagFacebookClientID),
			cmd.String(flagFacebookClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderFacebook, cmd.StringSlice(flagFacebookScope)),
		)
	}

	if cmd.Bool(flagWindowsliveEnabled) {
		providersMap["windowslive"] = providers.NewWindowsliveProvider(
			cmd.String(flagWindowsliveClientID),
			cmd.String(flagWindowsliveClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderWindowslive, cmd.StringSlice(flagWindowsliveScope)),
		)
	}

	if cmd.Bool(flagStravaEnabled) {
		providersMap["strava"] = providers.NewStravaProvider(
			cmd.String(flagStravaClientID),
			cmd.String(flagStravaClientSecret),
			cmd.String(flagServerURL),
			getScopes(api.SignInProviderStrava, cmd.StringSlice(flagStravaScope)),
		)
	}

	if cmd.Bool(flagTwitterEnabled) {
		providersMap["twitter"] = providers.NewTwitterProvider(
			cmd.String(flagTwitterConsumerKey),
			cmd.String(flagTwitterConsumerSecret),
			cmd.String(flagServerURL),
		)
	}

	return providersMap, nil
}
