package providers

// Identifiers for the built-in oauth providers. These values are durable: they
// are the keys in the providers Map and the `provider_id` values stored in the
// database, so they must not change. The same literals are hardcoded in the
// api.IdTokenProvider* constants and in the SignInProvider / IdTokenProvider
// patterns in docs/openapi.yaml; names_test.go asserts the copies agree.
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
