# NAME

auth - Nhost Auth API server

# SYNOPSIS

auth

```
[--access-tokens-expires-in]=[value]
[--allow-redirect-urls]=[value]
[--allowed-email-domains]=[value]
[--allowed-emails]=[value]
[--allowed-locales]=[value]
[--api-prefix]=[value]
[--apple-audience]=[value]
[--apple-client-id]=[value]
[--apple-enabled]
[--apple-key-id]=[value]
[--apple-private-key]=[value]
[--apple-scope]=[value]
[--apple-team-id]=[value]
[--azuread-client-id]=[value]
[--azuread-client-secret]=[value]
[--azuread-enabled]
[--azuread-scope]=[value]
[--azuread-tenant]=[value]
[--bitbucket-client-id]=[value]
[--bitbucket-client-secret]=[value]
[--bitbucket-enabled]
[--bitbucket-scope]=[value]
[--block-email-domains]=[value]
[--block-emails]=[value]
[--client-url]=[value]
[--conceal-errors]
[--custom-claims-defaults]=[value]
[--custom-claims]=[value]
[--debug]
[--default-allowed-roles]=[value]
[--default-locale]=[value]
[--default-role]=[value]
[--disable-new-users]
[--disable-signup]
[--discord-client-id]=[value]
[--discord-client-secret]=[value]
[--discord-enabled]
[--discord-scope]=[value]
[--email-passwordless-enabled]
[--email-verification-required]
[--enable-anonymous-users]
[--enable-change-env]
[--entraid-client-id]=[value]
[--entraid-client-secret]=[value]
[--entraid-enabled]
[--entraid-scope]=[value]
[--entraid-tenant]=[value]
[--facebook-client-id]=[value]
[--facebook-client-secret]=[value]
[--facebook-enabled]
[--facebook-scope]=[value]
[--github-authorization-url]=[value]
[--github-client-id]=[value]
[--github-client-secret]=[value]
[--github-enabled]
[--github-scope]=[value]
[--github-token-url]=[value]
[--github-user-profile-url]=[value]
[--gitlab-client-id]=[value]
[--gitlab-client-secret]=[value]
[--gitlab-enabled]
[--gitlab-scope]=[value]
[--google-audience]=[value]
[--google-client-id]=[value]
[--google-client-secret]=[value]
[--google-enabled]
[--google-scope]=[value]
[--graphql-url]=[value]
[--gravatar-default]=[value]
[--gravatar-enabled]
[--gravatar-rating]=[value]
[--hasura-admin-secret]=[value]
[--hasura-graphql-jwt-secret]=[value]
[--help|-h]
[--linkedin-client-id]=[value]
[--linkedin-client-secret]=[value]
[--linkedin-enabled]
[--linkedin-scope]=[value]
[--log-format-text]
[--mfa-enabled]
[--mfa-totp-issuer]=[value]
[--otp-email-enabled]
[--password-hibp-enabled]
[--password-min-length]=[value]
[--port]=[value]
[--postgres-migrations]=[value]
[--postgres]=[value]
[--rate-limit-brute-force-burst]=[value]
[--rate-limit-brute-force-interval]=[value]
[--rate-limit-email-burst]=[value]
[--rate-limit-email-interval]=[value]
[--rate-limit-email-is-global]
[--rate-limit-enable]
[--rate-limit-global-burst]=[value]
[--rate-limit-global-interval]=[value]
[--rate-limit-memcache-prefix]=[value]
[--rate-limit-memcache-server]=[value]
[--rate-limit-signups-burst]=[value]
[--rate-limit-signups-interval]=[value]
[--rate-limit-sms-burst]=[value]
[--rate-limit-sms-interval]=[value]
[--refresh-token-expires-in]=[value]
[--require-elevated-claim]=[value]
[--server-url]=[value]
[--sms-passwordless-enabled]
[--sms-provider]=[value]
[--sms-twilio-account-sid]=[value]
[--sms-twilio-auth-token]=[value]
[--sms-twilio-messaging-service-id]=[value]
[--smtp-api-header]=[value]
[--smtp-auth-method]=[value]
[--smtp-host]=[value]
[--smtp-password]=[value]
[--smtp-port]=[value]
[--smtp-secure]
[--smtp-sender]=[value]
[--smtp-user]=[value]
[--spotify-client-id]=[value]
[--spotify-client-secret]=[value]
[--spotify-enabled]
[--spotify-scope]=[value]
[--strava-client-id]=[value]
[--strava-client-secret]=[value]
[--strava-enabled]
[--strava-scope]=[value]
[--templates-path]=[value]
[--turnstile-secret]=[value]
[--twitch-client-id]=[value]
[--twitch-client-secret]=[value]
[--twitch-enabled]
[--twitch-scope]=[value]
[--twitter-consumer-key]=[value]
[--twitter-consumer-secret]=[value]
[--twitter-enabled]
[--webauthn-attestation-timeout]=[value]
[--webauthn-enabled]
[--webauthn-rp-id]=[value]
[--webauthn-rp-name]=[value]
[--webauthn-rp-origins]=[value]
[--windowslive-client-id]=[value]
[--windowslive-client-secret]=[value]
[--windowslive-enabled]
[--windowslive-scope]=[value]
[--workos-client-id]=[value]
[--workos-client-secret]=[value]
[--workos-default-connection]=[value]
[--workos-default-domain]=[value]
[--workos-default-organization]=[value]
[--workos-enabled]
```

**Usage**:

```
auth [GLOBAL OPTIONS] [command [COMMAND OPTIONS]] [ARGUMENTS...]
```

# GLOBAL OPTIONS

**--access-tokens-expires-in**="": Access tokens expires in (seconds) (default: 900)

**--allow-redirect-urls**="": Allowed redirect URLs (default: [])

**--allowed-email-domains**="": Comma-separated list of email domains that can register (default: [])

**--allowed-emails**="": Comma-separated list of emails that can register (default: [])

**--allowed-locales**="": Allowed locales (default: [en])

**--api-prefix**="": prefix for all routes

**--apple-audience**="": Apple Audience. Used to verify the audience on JWT tokens provided by Apple. Needed for idtoken validation

**--apple-client-id**="": Apple OAuth client ID

**--apple-enabled**: Enable Apple OAuth provider

**--apple-key-id**="": Apple OAuth key ID

**--apple-private-key**="": Apple OAuth private key

**--apple-scope**="": Apple OAuth scope (default: [name email])

**--apple-team-id**="": Apple OAuth team ID

**--azuread-client-id**="": AzureAD OAuth client ID

**--azuread-client-secret**="": Azuread OAuth client secret

**--azuread-enabled**: Enable Azuread OAuth provider

**--azuread-scope**="": Azuread OAuth scope (default: [email profile openid offline_access])

**--azuread-tenant**="": Azuread Tenant (default: common)

**--bitbucket-client-id**="": Bitbucket OAuth client ID

**--bitbucket-client-secret**="": Bitbucket OAuth client secret

**--bitbucket-enabled**: Enable Bitbucket OAuth provider

**--bitbucket-scope**="": Bitbucket OAuth scope (default: [account])

**--block-email-domains**="": Comma-separated list of email domains that cannot register (default: [])

**--block-emails**="": Comma-separated list of email domains that cannot register (default: [])

**--client-url**="": URL of your frontend application. Used to redirect users to the right page once actions based on emails or OAuth succeed

**--conceal-errors**: Conceal sensitive error messages to avoid leaking information about user accounts to attackers

**--custom-claims**="": Custom claims

**--custom-claims-defaults**="": Custom claims defaults

**--debug**: enable debug logging

**--default-allowed-roles**="": Comma-separated list of default allowed user roles (default: [me])

**--default-locale**="": Default locale (default: en)

**--default-role**="": Default user role for registered users (default: user)

**--disable-new-users**: If set, new users will be disabled after finishing registration and won't be able to sign in

**--disable-signup**: If set to true, all signup methods will throw an unauthorized error

**--discord-client-id**="": Discord OAuth client ID

**--discord-client-secret**="": Discord OAuth client secret

**--discord-enabled**: Enable Discord OAuth provider

**--discord-scope**="": Discord OAuth scope (default: [identify email])

**--email-passwordless-enabled**: Enables passwordless authentication by email. SMTP must be configured

**--email-verification-required**: Require email to be verified for email signin

**--enable-anonymous-users**: Enable anonymous users

**--enable-change-env**: Enable change env. Do not do this in production!

**--entraid-client-id**="": EntraID OAuth client ID

**--entraid-client-secret**="": EntraID OAuth client secret

**--entraid-enabled**: Enable EntraID OAuth provider

**--entraid-scope**="": EntraID OAuth scope (default: [email profile openid offline_access])

**--entraid-tenant**="": EntraID Tenant (default: common)

**--facebook-client-id**="": Facebook OAuth client ID

**--facebook-client-secret**="": Facebook OAuth client secret

**--facebook-enabled**: Enable Facebook OAuth provider

**--facebook-scope**="": Facebook OAuth scope (default: [email])

**--github-authorization-url**="": GitHub OAuth authorization URL (default: https://github.com/login/oauth/authorize)

**--github-client-id**="": GitHub OAuth client ID

**--github-client-secret**="": GitHub OAuth client secret

**--github-enabled**: Enable GitHub OAuth provider

**--github-scope**="": GitHub OAuth scope (default: [user:email])

**--github-token-url**="": GitHub OAuth token URL (default: https://github.com/login/oauth/access_token)

**--github-user-profile-url**="": GitHub OAuth user profile URL (default: https://api.github.com/user)

**--gitlab-client-id**="": Gitlab OAuth client ID

**--gitlab-client-secret**="": Gitlab OAuth client secret

**--gitlab-enabled**: Enable Gitlab OAuth provider

**--gitlab-scope**="": Gitlab OAuth scope (default: [read_user])

**--google-audience**="": Google Audience. Used to verify the audience on JWT tokens provided by Google. Needed for idtoken validation

**--google-client-id**="": Google OAuth client ID

**--google-client-secret**="": Google OAuth client secret

**--google-enabled**: Enable Google OAuth provider

**--google-scope**="": Google OAuth scope (default: [openid email profile])

**--graphql-url**="": Hasura GraphQL endpoint. Required for custom claims

**--gravatar-default**="": Gravatar default (default: blank)

**--gravatar-enabled**: Enable gravatar

**--gravatar-rating**="": Gravatar rating (default: g)

**--hasura-admin-secret**="": Hasura admin secret. Required for custom claims

**--hasura-graphql-jwt-secret**="": Key used for generating JWTs. Must be `HMAC-SHA`-based and the same as configured in Hasura. More info: https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt.html#running-with-jwt

**--help, -h**: show help

**--linkedin-client-id**="": LinkedIn OAuth client ID

**--linkedin-client-secret**="": LinkedIn OAuth client secret

**--linkedin-enabled**: Enable LinkedIn OAuth provider

**--linkedin-scope**="": LinkedIn OAuth scope (default: [openid profile email])

**--log-format-text**: format logs in plain text

**--mfa-enabled**: Enable MFA

**--mfa-totp-issuer**="": Issuer for MFA TOTP (default: auth)

**--otp-email-enabled**: Enable OTP via email

**--password-hibp-enabled**: Check user's password against Pwned Passwords https://haveibeenpwned.com/Passwords

**--password-min-length**="": Minimum password length (default: 3)

**--port**="": Port to bind to (default: 4000)

**--postgres**="": PostgreSQL connection URI: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING (default: postgres://postgres:postgres@localhost:5432/local?sslmode=disable)

**--postgres-migrations**="": PostgreSQL connection URI for running migrations: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING. Required to inject the `auth` schema into the database. If not specied, the `postgres connection will be used

**--rate-limit-brute-force-burst**="": Brute force rate limit burst (default: 10)

**--rate-limit-brute-force-interval**="": Brute force rate limit interval (default: 5m0s)

**--rate-limit-email-burst**="": Email rate limit burst (default: 10)

**--rate-limit-email-interval**="": Email rate limit interval (default: 1h0m0s)

**--rate-limit-email-is-global**: Email rate limit is global instead of per user

**--rate-limit-enable**: Enable rate limiting

**--rate-limit-global-burst**="": Global rate limit burst (default: 100)

**--rate-limit-global-interval**="": Global rate limit interval (default: 1m0s)

**--rate-limit-memcache-prefix**="": Prefix for rate limit keys in memcache

**--rate-limit-memcache-server**="": Store sliding window rate limit data in memcache

**--rate-limit-signups-burst**="": Signups rate limit burst (default: 10)

**--rate-limit-signups-interval**="": Signups rate limit interval (default: 5m0s)

**--rate-limit-sms-burst**="": SMS rate limit burst (default: 10)

**--rate-limit-sms-interval**="": SMS rate limit interval (default: 1h0m0s)

**--refresh-token-expires-in**="": Refresh token expires in (seconds) (default: 2592000)

**--require-elevated-claim**="": Require x-hasura-auth-elevated claim to perform certain actions: create PATs, change email and/or password, enable/disable MFA and add security keys. If set to `recommended` the claim check is only performed if the user has a security key attached. If set to `required` the only action that won't require the claim is setting a security key for the first time. (default: disabled)

**--server-url**="": Server URL of where Auth service is running. This value is to used as a callback in email templates and for the OAuth authentication process

**--sms-passwordless-enabled**: Enable SMS passwordless authentication

**--sms-provider**="": SMS provider (twilio or modica) (default: twilio)

**--sms-twilio-account-sid**="": Twilio Account SID for SMS

**--sms-twilio-auth-token**="": Twilio Auth Token for SMS

**--sms-twilio-messaging-service-id**="": Twilio Messaging Service ID for SMS

**--smtp-api-header**="": SMTP API Header. Maps to header X-SMTPAPI

**--smtp-auth-method**="": SMTP Authentication method (default: PLAIN)

**--smtp-host**="": SMTP Host. If the host is 'postmark' then the Postmark API will be used. Use AUTH_SMTP_PASS as the server token, other SMTP options are ignored

**--smtp-password**="": SMTP password

**--smtp-port**="": SMTP port (default: 587)

**--smtp-secure**: Connect over TLS. Deprecated: It is recommended to use port 587 with STARTTLS instead of this option.

**--smtp-sender**="": SMTP sender

**--smtp-user**="": SMTP user

**--spotify-client-id**="": Spotify OAuth client ID

**--spotify-client-secret**="": Spotify OAuth client secret

**--spotify-enabled**: Enable Spotify OAuth provider

**--spotify-scope**="": Spotify OAuth scope (default: [user-read-email user-read-private])

**--strava-client-id**="": Strava OAuth client ID

**--strava-client-secret**="": Strava OAuth client secret

**--strava-enabled**: Enable Strava OAuth provider

**--strava-scope**="": Strava OAuth scope (default: [profile:read_all])

**--templates-path**="": Path to the email templates. Default to included ones if path isn't found (default: /app/email-templates)

**--turnstile-secret**="": Turnstile secret. If passed, enable Cloudflare's turnstile for signup methods. The header `X-Cf-Turnstile-Response ` will have to be included in the request for verification

**--twitch-client-id**="": Twitch OAuth client ID

**--twitch-client-secret**="": Twitch OAuth client secret

**--twitch-enabled**: Enable Twitch OAuth provider

**--twitch-scope**="": Twitch OAuth scope (default: [user:read:email])

**--twitter-consumer-key**="": Twitter OAuth consumer key

**--twitter-consumer-secret**="": Twitter OAuth consumer secret

**--twitter-enabled**: Enable Twitter OAuth provider

**--webauthn-attestation-timeout**="": Timeout for the attestation process in milliseconds (default: 60000)

**--webauthn-enabled**: When enabled, passwordless Webauthn authentication can be done via device supported strong authenticators like fingerprint, Face ID, etc.

**--webauthn-rp-id**="": Relying party id. If not set `AUTH_CLIENT_URL` will be used as a default

**--webauthn-rp-name**="": Relying party name. Friendly name visual to the user informing who requires the authentication. Probably your app's name

**--webauthn-rp-origins**="": Array of URLs where the registration is permitted and should have occurred on. `AUTH_CLIENT_URL` will be automatically added to the list of origins if is set (default: [])

**--windowslive-client-id**="": Windowslive OAuth client ID

**--windowslive-client-secret**="": Windows Live OAuth client secret

**--windowslive-enabled**: Enable Windowslive OAuth provider

**--windowslive-scope**="": Windows Live OAuth scope (default: [wl.basic wl.emails])

**--workos-client-id**="": WorkOS OAuth client ID

**--workos-client-secret**="": WorkOS OAuth client secret

**--workos-default-connection**="": WorkOS OAuth default connection

**--workos-default-domain**="": WorkOS OAuth default domain

**--workos-default-organization**="": WorkOS OAuth default organization

**--workos-enabled**: Enable WorkOS OAuth provider


# COMMANDS

## docs

Generate markdown documentation for the CLI

**--help, -h**: show help

**--output**="": Output file (default: stdout)

### help, h

Shows a list of commands or help for one command

## help, h

Shows a list of commands or help for one command
