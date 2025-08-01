package cmd

import (
	"fmt"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/providers"
	"github.com/urfave/cli/v2"
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
	cCtx *cli.Context,
) (providers.Map, error) {
	providersMap := make(providers.Map)

	if cCtx.Bool(flagGoogleEnabled) {
		providersMap["google"] = providers.NewGoogleProvider(
			cCtx.String(flagGoogleClientID),
			cCtx.String(flagGoogleClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderGoogle, cCtx.StringSlice(flagGoogleScope)),
		)
	}

	if cCtx.Bool(flagGithubEnabled) {
		providersMap["github"] = providers.NewGithubProvider(
			cCtx.String(flagGithubClientID),
			cCtx.String(flagGithubClientSecret),
			cCtx.String(flagServerURL),
			cCtx.String(flagGithubAuthorizationURL),
			cCtx.String(flagGithubTokenURL),
			cCtx.String(flagGithubUserProfileURL),
			getScopes(api.SignInProviderGithub, cCtx.StringSlice(flagGithubScope)),
		)
	}

	if cCtx.Bool(flagAppleEnabled) {
		clientSecret, err := providers.GenerateClientSecret(
			cCtx.String(flagAppleTeamID),
			cCtx.String(flagAppleKeyID),
			cCtx.String(flagAppleClientID),
			cCtx.String(flagApplePrivateKey),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Apple client secret: %w", err)
		}

		providersMap["apple"], err = providers.NewAppleProvider(
			cCtx.Context,
			cCtx.String(flagAppleClientID),
			clientSecret,
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderApple, cCtx.StringSlice(flagAppleScope)),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple provider: %w", err)
		}
	}

	if cCtx.Bool(flagLinkedInEnabled) {
		providersMap["linkedin"] = providers.NewLinkedInProvider(
			cCtx.String(flagLinkedInClientID),
			cCtx.String(flagLinkedInClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderLinkedin, cCtx.StringSlice(flagLinkedInScope)),
		)
	}

	if cCtx.Bool(flagDiscordEnabled) {
		providersMap["discord"] = providers.NewDiscordProvider(
			cCtx.String(flagDiscordClientID),
			cCtx.String(flagDiscordClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderDiscord, cCtx.StringSlice(flagDiscordScope)),
		)
	}

	if cCtx.Bool(flagSpotifyEnabled) {
		providersMap["spotify"] = providers.NewSpotifyProvider(
			cCtx.String(flagSpotifyClientID),
			cCtx.String(flagSpotifyClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderSpotify, cCtx.StringSlice(flagSpotifyScope)),
		)
	}

	if cCtx.Bool(flagTwitchEnabled) {
		providersMap["twitch"] = providers.NewTwitchProvider(
			cCtx.String(flagTwitchClientID),
			cCtx.String(flagTwitchClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderTwitch, cCtx.StringSlice(flagTwitchScope)),
		)
	}

	if cCtx.Bool(flagGitlabEnabled) {
		providersMap["gitlab"] = providers.NewGitlabProvider(
			cCtx.String(flagGitlabClientID),
			cCtx.String(flagGitlabClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderGitlab, cCtx.StringSlice(flagGitlabScope)),
		)
	}

	if cCtx.Bool(flagBitbucketEnabled) {
		providersMap["bitbucket"] = providers.NewBitbucketProvider(
			cCtx.String(flagBitbucketClientID),
			cCtx.String(flagBitbucketClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderBitbucket, cCtx.StringSlice(flagBitbucketScope)),
		)
	}

	if cCtx.Bool(flagWorkosEnabled) {
		providersMap["workos"] = providers.NewWorkosProvider(
			cCtx.String(flagWorkosClientID),
			cCtx.String(flagWorkosClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderWorkos, cCtx.StringSlice(flagWorkosScope)),
			cCtx.String(flagWorkosDefaultOrganization),
			cCtx.String(flagWorkosDefaultConnection),
			cCtx.String(flagWorkosDefaultDomain),
		)
	}

	if cCtx.Bool(flagAzureadEnabled) {
		providersMap["azuread"] = providers.NewAzureadProvider(
			cCtx.String(flagAzureadClientID),
			cCtx.String(flagAzureadClientSecret),
			cCtx.String(flagServerURL),
			cCtx.String(flagAzureadTenant),
			getScopes(api.SignInProviderAzuread, cCtx.StringSlice(flagAzureadScope)),
		)
	}

	if cCtx.Bool(flagFacebookEnabled) {
		providersMap["facebook"] = providers.NewFacebookProvider(
			cCtx.String(flagFacebookClientID),
			cCtx.String(flagFacebookClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderFacebook, cCtx.StringSlice(flagFacebookScope)),
		)
	}

	if cCtx.Bool(flagWindowsliveEnabled) {
		providersMap["windowslive"] = providers.NewWindowsliveProvider(
			cCtx.String(flagWindowsliveClientID),
			cCtx.String(flagWindowsliveClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderWindowslive, cCtx.StringSlice(flagWindowsliveScope)),
		)
	}

	if cCtx.Bool(flagStravaEnabled) {
		providersMap["strava"] = providers.NewStravaProvider(
			cCtx.String(flagStravaClientID),
			cCtx.String(flagStravaClientSecret),
			cCtx.String(flagServerURL),
			getScopes(api.SignInProviderStrava, cCtx.StringSlice(flagStravaScope)),
		)
	}

	if cCtx.Bool(flagTwitterEnabled) {
		providersMap["twitter"] = providers.NewTwitterProvider(
			cCtx.String(flagTwitterConsumerKey),
			cCtx.String(flagTwitterConsumerSecret),
			cCtx.String(flagServerURL),
		)
	}

	return providersMap, nil
}
