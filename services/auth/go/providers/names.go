package providers

// Identifiers for the built-in oauth providers. These values are durable: they
// are the keys in the providers Map and the `provider_id` values stored in the
// database, so they must not change. All of them are hardcoded again in the
// SignInProvider pattern in docs/openapi.yaml; apple and google alone are also
// hardcoded in the oidc.IDTokenProvider* constants and in the IdTokenProvider
// pattern, since they are the only two providers supporting id-token sign-in.
// names_test.go asserts the copies agree.
const (
	AppleID       = "apple"
	AzureadID     = "azuread"
	BitbucketID   = "bitbucket"
	DiscordID     = "discord"
	EntraidID     = "entraid"
	FacebookID    = "facebook"
	GithubID      = "github"
	GitlabID      = "gitlab"
	GoogleID      = "google"
	LinkedinID    = "linkedin"
	SpotifyID     = "spotify"
	StravaID      = "strava"
	TwitchID      = "twitch"
	TwitterID     = "twitter"
	WindowsliveID = "windowslive"
	WorkosID      = "workos"
)
