package cmd

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/urfave/cli/v3"
)

//nolint:cyclop
func getDefaultScopes(providerName string) []string {
	switch providerName {
	case providers.GoogleID:
		return providers.DefaultGoogleScopes
	case providers.DiscordID:
		return providers.DefaultDiscordScopes
	case providers.GithubID:
		return providers.DefaultGithubScopes
	case providers.AppleID:
		return providers.DefaultAppleScopes
	case providers.LinkedinID:
		return providers.DefaultLinkedInScopes
	case providers.SpotifyID:
		return providers.DefaultSpotifyScopes
	case providers.TwitchID:
		return providers.DefaultTwitchScopes
	case providers.GitlabID:
		return providers.DefaultGitlabScopes
	case providers.BitbucketID:
		return providers.DefaultBitbucketScopes
	case providers.WorkosID:
		return providers.DefaultWorkOSScopes
	case providers.AzureadID:
		return providers.DefaultAzureadScopes
	case providers.EntraidID:
		return providers.DefaultEntraIDScopes
	case providers.FacebookID:
		return providers.DefaultFacebookScopes
	case providers.WindowsliveID:
		return providers.DefaultWindowsliveScopes
	case providers.StravaID:
		return providers.DefaultStravaScopes
	case providers.TwitterID:
		return []string{}
	default:
		panic("Unknown OAuth2 provider: " + providerName)
	}
}

func getScopes(provider string, scopes []string) []string {
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
		providersMap[providers.GoogleID] = providers.NewGoogleProvider(
			cmd.String(flagGoogleClientID),
			cmd.String(flagGoogleClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.GoogleID, cmd.StringSlice(flagGoogleScope)),
		)
	}

	if cmd.Bool(flagGithubEnabled) {
		providersMap[providers.GithubID] = providers.NewGithubProvider(
			cmd.String(flagGithubClientID),
			cmd.String(flagGithubClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagGithubAuthorizationURL),
			cmd.String(flagGithubTokenURL),
			cmd.String(flagGithubUserProfileURL),
			getScopes(providers.GithubID, cmd.StringSlice(flagGithubScope)),
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

		providersMap[providers.AppleID], err = providers.NewAppleProvider(
			ctx,
			cmd.String(flagAppleClientID),
			clientSecret,
			cmd.String(flagServerURL),
			getScopes(providers.AppleID, cmd.StringSlice(flagAppleScope)),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple provider: %w", err)
		}
	}

	if cmd.Bool(flagLinkedInEnabled) {
		providersMap[providers.LinkedinID] = providers.NewLinkedInProvider(
			cmd.String(flagLinkedInClientID),
			cmd.String(flagLinkedInClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.LinkedinID, cmd.StringSlice(flagLinkedInScope)),
		)
	}

	if cmd.Bool(flagDiscordEnabled) {
		providersMap[providers.DiscordID] = providers.NewDiscordProvider(
			cmd.String(flagDiscordClientID),
			cmd.String(flagDiscordClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.DiscordID, cmd.StringSlice(flagDiscordScope)),
		)
	}

	if cmd.Bool(flagSpotifyEnabled) {
		providersMap[providers.SpotifyID] = providers.NewSpotifyProvider(
			cmd.String(flagSpotifyClientID),
			cmd.String(flagSpotifyClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.SpotifyID, cmd.StringSlice(flagSpotifyScope)),
		)
	}

	if cmd.Bool(flagTwitchEnabled) {
		providersMap[providers.TwitchID] = providers.NewTwitchProvider(
			cmd.String(flagTwitchClientID),
			cmd.String(flagTwitchClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.TwitchID, cmd.StringSlice(flagTwitchScope)),
		)
	}

	if cmd.Bool(flagGitlabEnabled) {
		providersMap[providers.GitlabID] = providers.NewGitlabProvider(
			cmd.String(flagGitlabClientID),
			cmd.String(flagGitlabClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.GitlabID, cmd.StringSlice(flagGitlabScope)),
		)
	}

	if cmd.Bool(flagBitbucketEnabled) {
		providersMap[providers.BitbucketID] = providers.NewBitbucketProvider(
			cmd.String(flagBitbucketClientID),
			cmd.String(flagBitbucketClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.BitbucketID, cmd.StringSlice(flagBitbucketScope)),
		)
	}

	if cmd.Bool(flagWorkosEnabled) {
		providersMap[providers.WorkosID] = providers.NewWorkosProvider(
			cmd.String(flagWorkosClientID),
			cmd.String(flagWorkosClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.WorkosID, cmd.StringSlice(flagWorkosScope)),
			cmd.String(flagWorkosDefaultOrganization),
			cmd.String(flagWorkosDefaultConnection),
			cmd.String(flagWorkosDefaultDomain),
		)
	}

	if cmd.Bool(flagAzureadEnabled) {
		logger.WarnContext(
			ctx, "AzureAD provider is deprecated, use EntraID provider instead",
		)

		providersMap[providers.AzureadID] = providers.NewAzureadProvider(
			cmd.String(flagAzureadClientID),
			cmd.String(flagAzureadClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagAzureadTenant),
			getScopes(providers.AzureadID, cmd.StringSlice(flagAzureadScope)),
		)
	}

	if cmd.Bool(flagEntraIDEnabled) {
		providersMap[providers.EntraidID] = providers.NewEntraIDProvider(
			cmd.String(flagEntraIDClientID),
			cmd.String(flagEntraIDClientSecret),
			cmd.String(flagServerURL),
			cmd.String(flagEntraIDTenant),
			getScopes(providers.EntraidID, cmd.StringSlice(flagEntraIDScope)),
		)
	}

	if cmd.Bool(flagFacebookEnabled) {
		providersMap[providers.FacebookID] = providers.NewFacebookProvider(
			cmd.String(flagFacebookClientID),
			cmd.String(flagFacebookClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.FacebookID, cmd.StringSlice(flagFacebookScope)),
		)
	}

	if cmd.Bool(flagWindowsliveEnabled) {
		providersMap[providers.WindowsliveID] = providers.NewWindowsliveProvider(
			cmd.String(flagWindowsliveClientID),
			cmd.String(flagWindowsliveClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.WindowsliveID, cmd.StringSlice(flagWindowsliveScope)),
		)
	}

	if cmd.Bool(flagStravaEnabled) {
		providersMap[providers.StravaID] = providers.NewStravaProvider(
			cmd.String(flagStravaClientID),
			cmd.String(flagStravaClientSecret),
			cmd.String(flagServerURL),
			getScopes(providers.StravaID, cmd.StringSlice(flagStravaScope)),
		)
	}

	if cmd.Bool(flagTwitterEnabled) {
		providersMap[providers.TwitterID] = providers.NewTwitterProvider(
			cmd.String(flagTwitterConsumerKey),
			cmd.String(flagTwitterConsumerSecret),
			cmd.String(flagServerURL),
		)
	}

	return providersMap, nil
}
