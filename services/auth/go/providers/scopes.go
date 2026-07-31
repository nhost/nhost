package providers

import "slices"

//nolint:gochecknoglobals
var (
	// DefaultGoogleScopes defines the default scopes for Google OAuth2.
	DefaultGoogleScopes = []string{"openid", "email", "profile"}

	// DefaultGithubScopes defines the default scopes for GitHub OAuth2.
	DefaultGithubScopes = []string{"user:email"}

	// DefaultAppleScopes defines the default scopes for Apple OAuth2.
	DefaultAppleScopes = []string{"name", "email"}

	// DefaultLinkedInScopes defines the default scopes for LinkedIn OAuth2.
	DefaultLinkedInScopes = []string{"openid", "profile", "email"}

	// DefaultDiscordScopes defines the default scopes for Discord OAuth2.
	DefaultDiscordScopes = []string{"identify", "email"}

	// DefaultSpotifyScopes defines the default scopes for Spotify OAuth2.
	DefaultSpotifyScopes = []string{"user-read-email", "user-read-private"}

	// DefaultTwitchScopes defines the default scopes for Twitch OAuth2.
	DefaultTwitchScopes = []string{"user:read:email"}

	// DefaultGitlabScopes defines the default scopes for Gitlab OAuth2.
	DefaultGitlabScopes = []string{"read_user"}

	// DefaultBitbucketScopes defines the default scopes for Bitbucket OAuth2.
	DefaultBitbucketScopes = []string{"account"}

	// DefaultWorkOSScopes defines the default scopes for WorkOS OAuth2.
	DefaultWorkOSScopes = []string{""}

	// DefaultAzureadScopes defines the default scopes for AzureAd OAuth2.
	DefaultAzureadScopes = []string{"email", "profile", "openid", "offline_access"}

	// DefaultEntraIDScopes defines the default scopes for EntraID OAuth2.
	DefaultEntraIDScopes = []string{"email", "profile", "openid", "offline_access"}

	// DefaultFacebookScopes defines the default scopes for Facebook OAuth2.
	DefaultFacebookScopes = []string{"email"}

	// DefaultWindowsliveScopes defines the default scopes for WindowsLive OAuth2.
	DefaultWindowsliveScopes = []string{"wl.basic", "wl.emails"}

	// DefaultStravaScopes defines the default scopes for Strava OAuth2.
	DefaultStravaScopes = []string{"profile:read_all"}
)

// defaultOIDCScopes returns the scopes requested from an OIDC provider when
// the configuration does not specify any.
func defaultOIDCScopes() []string {
	return []string{"openid", "email", "profile"}
}

// withOpenIDScope guarantees the openid scope is present: it is what makes the
// IdP return an id_token, which the whole OIDC flow — identity included — is
// derived from, so an operator who overrides the scope list without it would
// silently lose the login method. An empty list falls back to the standard set.
//
// newOIDCProvider applies it for every provider on the engine;
// decodeOIDCDefinition also does, because the decoded list is what an operator
// sees echoed back. The result is always a fresh slice — callers pass the
// Default*Scopes globals above, which must never be appended to in place.
func withOpenIDScope(scopes []string) []string {
	if len(scopes) == 0 {
		return defaultOIDCScopes()
	}

	if slices.Contains(scopes, "openid") {
		return slices.Clone(scopes)
	}

	return append(slices.Clone(scopes), "openid")
}
