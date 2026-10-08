package cmd

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/urfave/cli/v3"
)

var (
	errEncryptionKeyRequired      = errors.New("EncryptionKey is required")
	errPostgresConnectionRequired = errors.New("PostgresConnection is required")
	errHasuraGraphqlURLRequired   = errors.New("HasuraGraphqlURL is required")
	errJWTSecretRequired          = errors.New("JWT.Secret is required")
	errInvalidEnumValue           = errors.New("invalid value")
	errOAuth2LoginURLRequired     = errors.New(
		"OAuth2Provider.LoginURL or ClientURL is required when OAuth2Provider is enabled",
	)
	errOAuth2TTLNotPositive = errors.New(
		"OAuth2Provider token TTLs must be a positive number of seconds",
	)
)

// The values the enum-valued settings accept, shared by the serve command's
// EnumValue flags and Validate.
func gravatarDefaults() []string {
	return []string{"blank", "identicon", "monsterid", "wavatar", "retro", "robohash", "mp", "404"}
}

func gravatarRatings() []string { return []string{"g", "pg", "r", "x"} }

func smtpAuthMethods() []string { return []string{"LOGIN", "PLAIN", "CRAM-MD5"} }

func elevatedClaimSettings() []string { return []string{"disabled", "recommended", "required"} }

// Options is everything NewService needs to build auth. It carries no
// listener settings: whoever runs the service owns the listener, so the port
// stays with the standalone serve command or the engine.
type Options struct {
	// Version is reported by the version endpoint.
	Version string

	// APIPrefix is the path every route is served under.
	APIPrefix string
	// ServerURL is auth's own public URL, used for OAuth callbacks and in email
	// links.
	ServerURL string
	// ClientURL is the frontend URL users are redirected to.
	ClientURL string
	// AllowedRedirectURLs are the redirect targets accepted besides ClientURL.
	AllowedRedirectURLs []string

	// PostgresConnection is the database auth serves from.
	// PostgresMigrationsConnection, when set, is used for migrations instead.
	PostgresConnection           string
	PostgresMigrationsConnection string
	// HasuraGraphqlURL is Hasura's /v1/graphql endpoint; its metadata endpoint
	// is derived from it.
	HasuraGraphqlURL  string
	HasuraAdminSecret string

	// EncryptionKey is a hex-encoded 32-byte key for sensitive data at rest.
	EncryptionKey string

	JWT JWTOptions

	DefaultRole         string
	DefaultAllowedRoles []string
	DefaultLocale       string
	AllowedLocales      []string

	DisableSignup         bool
	DisableNewUsers       bool
	DisableAutoSignup     bool
	AnonymousUsersEnabled bool
	// RequireEmailVerification blocks email sign-in until the email is
	// verified.
	RequireEmailVerification bool

	AllowedEmails       []string
	AllowedEmailDomains []string
	BlockedEmails       []string
	BlockedEmailDomains []string

	PasswordMinLength   int
	PasswordHIBPEnabled bool

	Gravatar GravatarOptions

	EmailPasswordlessEnabled bool
	OTPEmailEnabled          bool
	// EmailTemplatesPath is searched first for email and SMS templates.
	EmailTemplatesPath string
	SMTP               SMTPOptions
	SMS                SMSOptions

	Webauthn WebauthnOptions
	MFA      MFAOptions

	Providers      ProvidersOptions
	OAuth2Provider OAuth2ProviderOptions

	RateLimit RateLimitOptions
	// TurnstileSecret, when set, requires a Cloudflare Turnstile token on
	// sign-up, passwordless and OTP sign-in, and password-reset requests.
	TurnstileSecret string

	// ConcealErrors hides error details that would reveal whether an account
	// exists.
	ConcealErrors bool
	// EnableChangeEnv exposes the change-env endpoint, which rewrites this
	// configuration at runtime. Never enable it in production.
	EnableChangeEnv bool
}

// JWTOptions configures the tokens auth issues.
type JWTOptions struct {
	// Secret is Hasura's JWT secret configuration, in JSON.
	Secret string
	// AccessTokenExpiresIn and RefreshTokenExpiresIn are in seconds.
	AccessTokenExpiresIn  int
	RefreshTokenExpiresIn int
	// CustomClaims and CustomClaimsDefaults are JSON objects.
	CustomClaims         string
	CustomClaimsDefaults string
	// RequireElevatedClaim is "disabled", "recommended" or "required".
	RequireElevatedClaim string
}

type GravatarOptions struct {
	Enabled bool
	// Default is one of blank, identicon, monsterid, wavatar, retro, robohash,
	// mp or 404.
	Default string
	// Rating is g, pg, r or x.
	Rating string
}

// SMTPOptions configures outgoing email. A Host of "postmark" sends through
// Postmark's API with Password as the server token instead.
type SMTPOptions struct {
	Host     string
	Port     uint16
	Secure   bool
	User     string
	Password string
	Sender   string
	// APIHeader, when set, is sent as the X-SMTPAPI header.
	APIHeader string
	// AuthMethod is LOGIN, PLAIN or CRAM-MD5.
	AuthMethod string
}

// SMSOptions configures SMS sign-in. Provider is twilio (the default when
// empty), modica, generic or dev.
type SMSOptions struct {
	PasswordlessEnabled bool
	Provider            string
	Twilio              TwilioOptions
	Modica              ModicaOptions
	Generic             GenericSMSOptions
	// DevOutputDir is where the dev provider writes each message, to
	// <phone>.txt. For testing only.
	DevOutputDir string
}

type TwilioOptions struct {
	AccountSID string
	AuthToken  string
	// MessagingServiceID is a Messaging Service SID or a From phone number.
	MessagingServiceID string
}

type ModicaOptions struct {
	Username string
	Password string
}

type GenericSMSOptions struct {
	URL         string
	ContentType string
	// Headers is a JSON object of extra request headers.
	Headers      string
	Timeout      time.Duration
	BodyTemplate string
}

type WebauthnOptions struct {
	Enabled bool
	// RPID defaults to ClientURL's host, and RPName to RPID. ClientURL is
	// always an allowed origin besides RPOrigins.
	RPID               string
	RPName             string
	RPOrigins          []string
	AttestationTimeout time.Duration
}

type MFAOptions struct {
	Enabled    bool
	TOTPIssuer string
}

// ProvidersOptions configures the social sign-in providers.
type ProvidersOptions struct {
	Apple       AppleOptions
	Azuread     TenantProviderOptions
	Bitbucket   ProviderOptions
	Discord     ProviderOptions
	EntraID     TenantProviderOptions
	Facebook    ProviderOptions
	Github      GithubOptions
	Gitlab      ProviderOptions
	Google      GoogleOptions
	LinkedIn    ProviderOptions
	Spotify     ProviderOptions
	Strava      ProviderOptions
	Twitch      ProviderOptions
	Twitter     TwitterOptions
	Windowslive ProviderOptions
	Workos      WorkosOptions
}

// ProviderOptions configures an OAuth2 sign-in provider. An empty Scope uses
// the provider's default scopes.
type ProviderOptions struct {
	Enabled      bool
	ClientID     string
	ClientSecret string
	Scope        []string
}

type GithubOptions struct {
	ProviderOptions

	AuthorizationURL string
	TokenURL         string
	UserProfileURL   string
}

type GoogleOptions struct {
	ProviderOptions

	// Audience lists the client IDs accepted on ID tokens for native sign-in.
	Audience []string
}

// AppleOptions has no client secret: it is generated from TeamID, KeyID and
// PrivateKey.
type AppleOptions struct {
	Enabled    bool
	ClientID   string
	TeamID     string
	KeyID      string
	PrivateKey string
	Scope      []string
	// Audience lists the client IDs accepted on ID tokens for native sign-in.
	Audience []string
}

type TenantProviderOptions struct {
	ProviderOptions

	Tenant string
}

type WorkosOptions struct {
	ProviderOptions

	DefaultOrganization string
	DefaultConnection   string
	DefaultDomain       string
}

type TwitterOptions struct {
	Enabled        bool
	ConsumerKey    string
	ConsumerSecret string
}

// OAuth2ProviderOptions configures auth acting as an OAuth2 authorization
// server. It requires an RSA JWT secret.
type OAuth2ProviderOptions struct {
	Enabled bool
	// LoginURL is the consent/login UI; it defaults to ClientURL + "/oauth2/login".
	LoginURL string
	// AccessTokenTTL and RefreshTokenTTL are in seconds.
	AccessTokenTTL  int
	RefreshTokenTTL int
	// CIMDEnabled accepts Client ID Metadata Documents as client IDs.
	CIMDEnabled bool
	// CIMDAllowInsecureTransport allows fetching those documents over HTTP and
	// from private IPs. For development only.
	CIMDAllowInsecureTransport bool
}

// RateLimitOptions configures request rate limits. Limits are kept in memory
// unless MemcacheServer is set.
type RateLimitOptions struct {
	Enabled      bool
	Global       RateLimitBucket
	Email        RateLimitBucket
	SMS          RateLimitBucket
	BruteForce   RateLimitBucket
	Signups      RateLimitBucket
	OAuth2Server RateLimitBucket
	// EmailIsGlobal applies the email limit globally instead of per user.
	EmailIsGlobal  bool
	MemcacheServer string
	MemcachePrefix string
}

// RateLimitBucket allows Burst requests per Interval.
type RateLimitBucket struct {
	Burst    int
	Interval time.Duration
}

// Validate reports the settings NewService would reject before connecting to
// anything, so a caller running several services can check all of them before
// building any. Checks that need a built dependency, such as the OAuth2
// provider requiring an RSA JWT secret, still happen in NewService.
func (o Options) Validate() error {
	var errs []error

	for _, required := range []struct {
		value string
		err   error
	}{
		{o.EncryptionKey, errEncryptionKeyRequired},
		{o.PostgresConnection, errPostgresConnectionRequired},
		{o.HasuraGraphqlURL, errHasuraGraphqlURLRequired},
		{o.JWT.Secret, errJWTSecretRequired},
	} {
		if required.value == "" {
			errs = append(errs, required.err)
		}
	}

	for _, enum := range []struct {
		name    string
		value   string
		allowed []string
	}{
		{"Gravatar.Default", o.Gravatar.Default, gravatarDefaults()},
		{"Gravatar.Rating", o.Gravatar.Rating, gravatarRatings()},
		{"SMTP.AuthMethod", o.SMTP.AuthMethod, smtpAuthMethods()},
		{"JWT.RequireElevatedClaim", o.JWT.RequireElevatedClaim, elevatedClaimSettings()},
	} {
		if !slices.Contains(enum.allowed, enum.value) {
			errs = append(errs, fmt.Errorf(
				"%s: %w %q, allowed values are %s",
				enum.name, errInvalidEnumValue, enum.value, strings.Join(enum.allowed, ", "),
			))
		}
	}

	if o.OAuth2Provider.Enabled {
		if o.OAuth2Provider.LoginURL == "" && o.ClientURL == "" {
			errs = append(errs, errOAuth2LoginURLRequired)
		}

		if o.OAuth2Provider.AccessTokenTTL <= 0 || o.OAuth2Provider.RefreshTokenTTL <= 0 {
			errs = append(errs, errOAuth2TTLNotPositive)
		}
	}

	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("invalid auth options: %w", err)
	}

	return nil
}

func providerFromCommand(
	cmd *cli.Command, enabled, clientID, clientSecret, scope string,
) ProviderOptions {
	return ProviderOptions{
		Enabled:      cmd.Bool(enabled),
		ClientID:     cmd.String(clientID),
		ClientSecret: cmd.String(clientSecret),
		Scope:        cmd.StringSlice(scope),
	}
}

func tenantProviderFromCommand(
	cmd *cli.Command, enabled, clientID, clientSecret, scope, tenant string,
) TenantProviderOptions {
	return TenantProviderOptions{
		ProviderOptions: providerFromCommand(cmd, enabled, clientID, clientSecret, scope),
		Tenant:          cmd.String(tenant),
	}
}

func rateLimitBucketFromCommand(cmd *cli.Command, burst, interval string) RateLimitBucket {
	return RateLimitBucket{Burst: cmd.Int(burst), Interval: cmd.Duration(interval)}
}

// optionsFromCommand maps the serve command's flags onto Options. It does not
// validate; NewService does.
//
//nolint:funlen // one assignment per flag; splitting would only scatter them
func optionsFromCommand(cmd *cli.Command) Options {
	smtpPort := uint16(cmd.Uint(flagSMTPPort)) //nolint:gosec // was truncated the same way before

	return Options{
		Version:                      cmd.Root().Version,
		APIPrefix:                    cmd.String(flagAPIPrefix),
		ServerURL:                    cmd.String(flagServerURL),
		ClientURL:                    cmd.String(flagClientURL),
		AllowedRedirectURLs:          cmd.StringSlice(flagAllowRedirectURLs),
		PostgresConnection:           cmd.String(flagPostgresConnection),
		PostgresMigrationsConnection: cmd.String(flagPostgresMigrationsConnection),
		HasuraGraphqlURL:             cmd.String(flagGraphqlURL),
		HasuraAdminSecret:            cmd.String(flagHasuraAdminSecret),
		EncryptionKey:                cmd.String(flagEncryptionKey),
		JWT: JWTOptions{
			Secret:                cmd.String(flagHasuraGraphqlJWTSecret),
			AccessTokenExpiresIn:  cmd.Int(flagAccessTokensExpiresIn),
			RefreshTokenExpiresIn: cmd.Int(flagRefreshTokenExpiresIn),
			CustomClaims:          cmd.String(flagCustomClaims),
			CustomClaimsDefaults:  cmd.String(flagCustomClaimsDefaults),
			RequireElevatedClaim:  cmd.String(flagRequireElevatedClaim),
		},
		DefaultRole:              cmd.String(flagDefaultRole),
		DefaultAllowedRoles:      cmd.StringSlice(flagDefaultAllowedRoles),
		DefaultLocale:            cmd.String(flagDefaultLocale),
		AllowedLocales:           cmd.StringSlice(flagAllowedLocales),
		DisableSignup:            cmd.Bool(flagDisableSignup),
		DisableNewUsers:          cmd.Bool(flagDisableNewUsers),
		DisableAutoSignup:        cmd.Bool(flagDisableAutoSignup),
		AnonymousUsersEnabled:    cmd.Bool(flagAnonymousUsersEnabled),
		RequireEmailVerification: cmd.Bool(flagEmailSigninEmailVerifiedRequired),
		AllowedEmails:            cmd.StringSlice(flagAllowedEmails),
		AllowedEmailDomains:      cmd.StringSlice(flagAllowedEmailDomains),
		BlockedEmails:            cmd.StringSlice(flagBlockedEmails),
		BlockedEmailDomains:      cmd.StringSlice(flagBlockedEmailDomains),
		PasswordMinLength:        cmd.Int(flagPasswordMinLength),
		PasswordHIBPEnabled:      cmd.Bool(flagPasswordHIBPEnabled),
		Gravatar: GravatarOptions{
			Enabled: cmd.Bool(flagGravatarEnabled),
			Default: cmd.String(flagGravatarDefault),
			Rating:  cmd.String(flagGravatarRating),
		},
		EmailPasswordlessEnabled: cmd.Bool(flagEmailPasswordlessEnabled),
		OTPEmailEnabled:          cmd.Bool(flagOTPEmailEnabled),
		EmailTemplatesPath:       cmd.String(flagEmailTemplatesPath),
		SMTP: SMTPOptions{
			Host:       cmd.String(flagSMTPHost),
			Port:       smtpPort,
			Secure:     cmd.Bool(flagSMTPSecure),
			User:       cmd.String(flagSMTPUser),
			Password:   cmd.String(flagSMTPPassword),
			Sender:     cmd.String(flagSMTPSender),
			APIHeader:  cmd.String(flagSMTPAPIHedaer),
			AuthMethod: cmd.String(flagSMTPAuthMethod),
		},
		SMS: SMSOptions{
			PasswordlessEnabled: cmd.Bool(flagSMSPasswordlessEnabled),
			Provider:            cmd.String(flagSMSProvider),
			Twilio: TwilioOptions{
				AccountSID:         cmd.String(flagSMSTwilioAccountSid),
				AuthToken:          cmd.String(flagSMSTwilioAuthToken),
				MessagingServiceID: cmd.String(flagSMSTwilioMessagingServiceID),
			},
			Modica: ModicaOptions{
				Username: cmd.String(flagSMSModicaUsername),
				Password: cmd.String(flagSMSModicaPassword),
			},
			Generic: GenericSMSOptions{
				URL:          cmd.String(flagSMSGenericURL),
				ContentType:  cmd.String(flagSMSGenericContentType),
				Headers:      cmd.String(flagSMSGenericHeaders),
				Timeout:      cmd.Duration(flagSMSGenericTimeout),
				BodyTemplate: cmd.String(flagSMSGenericBodyTemplate),
			},
			DevOutputDir: cmd.String(flagSMSDevOutputDir),
		},
		Webauthn: WebauthnOptions{
			Enabled:   cmd.Bool(flagWebauthnEnabled),
			RPID:      cmd.String(flagWebauthnRPID),
			RPName:    cmd.String(flagWebauhtnRPName),
			RPOrigins: cmd.StringSlice(flagWebauthnRPOrigins),
			// TODO: the flag is an IntFlag of milliseconds, so reading it
			// as a duration always yields 0 and the WebAuthn library's default
			// applies; AUTH_WEBAUTHN_ATTESTATION_TIMEOUT has no effect. Kept
			// as-is to preserve behavior. Fix by reading
			// time.Duration(cmd.Int(...)) * time.Millisecond, which starts
			// honoring configured values.
			AttestationTimeout: cmd.Duration(flagWebauthnAttestationTimeout),
		},
		MFA: MFAOptions{
			Enabled:    cmd.Bool(flagMfaEnabled),
			TOTPIssuer: cmd.String(flagMfaTotpIssuer),
		},
		Providers: ProvidersOptions{
			Apple: AppleOptions{
				Enabled:    cmd.Bool(flagAppleEnabled),
				ClientID:   cmd.String(flagAppleClientID),
				TeamID:     cmd.String(flagAppleTeamID),
				KeyID:      cmd.String(flagAppleKeyID),
				PrivateKey: cmd.String(flagApplePrivateKey),
				Scope:      cmd.StringSlice(flagAppleScope),
				Audience:   cmd.StringSlice(flagAppleAudience),
			},
			Azuread: tenantProviderFromCommand(
				cmd, flagAzureadEnabled, flagAzureadClientID, flagAzureadClientSecret,
				flagAzureadScope, flagAzureadTenant,
			),
			Bitbucket: providerFromCommand(
				cmd, flagBitbucketEnabled, flagBitbucketClientID, flagBitbucketClientSecret,
				flagBitbucketScope,
			),
			Discord: providerFromCommand(
				cmd, flagDiscordEnabled, flagDiscordClientID, flagDiscordClientSecret,
				flagDiscordScope,
			),
			EntraID: tenantProviderFromCommand(
				cmd, flagEntraIDEnabled, flagEntraIDClientID, flagEntraIDClientSecret,
				flagEntraIDScope, flagEntraIDTenant,
			),
			Facebook: providerFromCommand(
				cmd, flagFacebookEnabled, flagFacebookClientID, flagFacebookClientSecret,
				flagFacebookScope,
			),
			Github: GithubOptions{
				ProviderOptions: providerFromCommand(
					cmd, flagGithubEnabled, flagGithubClientID, flagGithubClientSecret,
					flagGithubScope,
				),
				AuthorizationURL: cmd.String(flagGithubAuthorizationURL),
				TokenURL:         cmd.String(flagGithubTokenURL),
				UserProfileURL:   cmd.String(flagGithubUserProfileURL),
			},
			Gitlab: providerFromCommand(
				cmd, flagGitlabEnabled, flagGitlabClientID, flagGitlabClientSecret,
				flagGitlabScope,
			),
			Google: GoogleOptions{
				ProviderOptions: providerFromCommand(
					cmd, flagGoogleEnabled, flagGoogleClientID, flagGoogleClientSecret,
					flagGoogleScope,
				),
				Audience: cmd.StringSlice(flagGoogleAudience),
			},
			LinkedIn: providerFromCommand(
				cmd, flagLinkedInEnabled, flagLinkedInClientID, flagLinkedInClientSecret,
				flagLinkedInScope,
			),
			Spotify: providerFromCommand(
				cmd, flagSpotifyEnabled, flagSpotifyClientID, flagSpotifyClientSecret,
				flagSpotifyScope,
			),
			Strava: providerFromCommand(
				cmd, flagStravaEnabled, flagStravaClientID, flagStravaClientSecret,
				flagStravaScope,
			),
			Twitch: providerFromCommand(
				cmd, flagTwitchEnabled, flagTwitchClientID, flagTwitchClientSecret,
				flagTwitchScope,
			),
			Twitter: TwitterOptions{
				Enabled:        cmd.Bool(flagTwitterEnabled),
				ConsumerKey:    cmd.String(flagTwitterConsumerKey),
				ConsumerSecret: cmd.String(flagTwitterConsumerSecret),
			},
			Windowslive: providerFromCommand(
				cmd, flagWindowsliveEnabled, flagWindowsliveClientID, flagWindowsliveClientSecret,
				flagWindowsliveScope,
			),
			Workos: WorkosOptions{
				// TODO: there is no WorkOS scope flag (unlike every other
				// OAuth provider), so WorkOS always uses its default scopes.
				// Fix by adding a workos-scope StringSliceFlag
				// (AUTH_PROVIDER_WORKOS_SCOPE) and reading it here.
				ProviderOptions: ProviderOptions{
					Enabled:      cmd.Bool(flagWorkosEnabled),
					ClientID:     cmd.String(flagWorkosClientID),
					ClientSecret: cmd.String(flagWorkosClientSecret),
					Scope:        nil,
				},
				DefaultOrganization: cmd.String(flagWorkosDefaultOrganization),
				DefaultConnection:   cmd.String(flagWorkosDefaultConnection),
				DefaultDomain:       cmd.String(flagWorkosDefaultDomain),
			},
		},
		OAuth2Provider: OAuth2ProviderOptions{
			Enabled:                    cmd.Bool(flagOAuth2ProviderEnabled),
			LoginURL:                   cmd.String(flagOAuth2ProviderLoginURL),
			AccessTokenTTL:             cmd.Int(flagOAuth2ProviderAccessTokenTTL),
			RefreshTokenTTL:            cmd.Int(flagOAuth2ProviderRefreshTokenTTL),
			CIMDEnabled:                cmd.Bool(flagOAuth2ProviderCIMDEnabled),
			CIMDAllowInsecureTransport: cmd.Bool(flagOAuth2ProviderCIMDAllowInsecureTransport),
		},
		RateLimit: RateLimitOptions{
			Enabled: cmd.Bool(flagRateLimitEnable),
			Global: rateLimitBucketFromCommand(
				cmd, flagRateLimitGlobalBurst, flagRateLimitGlobalInterval,
			),
			Email: rateLimitBucketFromCommand(
				cmd, flagRateLimitEmailBurst, flagRateLimitEmailInterval,
			),
			SMS: rateLimitBucketFromCommand(cmd, flagRateLimitSMSBurst, flagRateLimitSMSInterval),
			BruteForce: rateLimitBucketFromCommand(
				cmd, flagRateLimitBruteForceBurst, flagRateLimitBruteForceInterval,
			),
			Signups: rateLimitBucketFromCommand(
				cmd, flagRateLimitSignupsBurst, flagRateLimitSignupsInterval,
			),
			OAuth2Server: rateLimitBucketFromCommand(
				cmd, flagRateLimitOAuth2ServerBurst, flagRateLimitOAuth2ServerInterval,
			),
			EmailIsGlobal:  cmd.Bool(flagRateLimitEmailIsGlobal),
			MemcacheServer: cmd.String(flagRateLimitMemcacheServer),
			MemcachePrefix: cmd.String(flagRateLimitMemcachePrefix),
		},
		TurnstileSecret: cmd.String(flagTurnstileSecret),
		ConcealErrors:   cmd.Bool(flagConcealErrors),
		EnableChangeEnv: cmd.Bool(flagEnableChangeEnv),
	}
}
