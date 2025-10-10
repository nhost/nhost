package providers

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
