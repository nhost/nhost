package cmd

import (
	"fmt"
	"slices"
	"strings"
)

// EnumValue is a flag.Value that can be used to restrict the
// values of a flag to a list of allowed values.
type EnumValue struct {
	Enum     []string
	Default  string
	selected string
}

func (e *EnumValue) Get() any {
	if e.selected == "" {
		return e.Default
	}

	return e.selected
}

func (e *EnumValue) Set(value string) error {
	if slices.Contains(e.Enum, value) {
		e.selected = value
		return nil
	}

	return fmt.Errorf("allowed values are %s", strings.Join(e.Enum, ", ")) //nolint: err113
}

func (e *EnumValue) String() string {
	if s, ok := e.Get().(string); ok {
		return s
	}

	return ""
}

// Repeated flag and provider identifiers.
const (
	plain            = "PLAIN"
	jwt              = "jwt"
	oauthApple       = "oauth-apple"
	oauthAzuread     = "oauth-azuread"
	oauthBitbucket   = "oauth-bitbucket"
	oauthDiscord     = "oauth-discord"
	oauthEntraid     = "oauth-entraid"
	oauthFacebook    = "oauth-facebook"
	oauthGithub      = "oauth-github"
	oauthGitlab      = "oauth-gitlab"
	oauthGoogle      = "oauth-google"
	oauthLinkedin    = "oauth-linkedin"
	oauthSpotify     = "oauth-spotify"
	oauthStrava      = "oauth-strava"
	oauthTwitch      = "oauth-twitch"
	oauthTwitter     = "oauth-twitter"
	oauthWindowslive = "oauth-windowslive"
	oauthWorkos      = "oauth-workos"
	oauth2Provider   = "oauth2-provider"
	rateLimit        = "rate-limit"
	serverKey        = "server"
	signup           = "signup"
	smsKey           = "sms"
	smtpKey          = "smtp"
	twilio           = "twilio"
	webauthn         = "webauthn"
)
