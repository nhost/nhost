package schema

import (
	"list"
	"math"
	"net"
	"strings"
	"time"
)

// main entrypoint to the configuration
#Config: {
	// Global configuration that applies to all services
	global: #Global

	// Configuration for hasura
	hasura: #Hasura

	// Advanced configuration for GraphQL
	graphql?: #Graphql

	// Configuration for functions service
	functions: #Functions

	// Configuration for auth service
	auth: #Auth

	// Configuration for postgres service
	postgres: #Postgres

	// Configuration for third party providers like SMTP, SMS, etc.
	provider: #Provider

	// Configuration for storage service
	storage: #Storage

	// Configuration for graphite service
	ai?: #AI

	// Configuration for observability service
	observability: #Observability

	// Experimental configuration for unreleased services. Subject to breaking changes.
	experimental?: #Experimental

	_totalResourcesCPU: (
				hasura.resources.replicas*hasura.resources.compute.cpu +
		auth.resources.replicas*auth.resources.compute.cpu +
		storage.resources.replicas*storage.resources.compute.cpu +
		postgres.resources.compute.cpu) @cuegraph(skip)

	_totalResourcesMemory: (
				hasura.resources.replicas*hasura.resources.compute.memory +
		auth.resources.replicas*auth.resources.compute.memory +
		storage.resources.replicas*storage.resources.compute.memory +
		postgres.resources.compute.memory) @cuegraph(skip)

	_validateResourcesTotalCpuMemoryRatioMustBe1For2: (
								_totalResourcesCPU*2.048 & _totalResourcesMemory*1.0) @cuegraph(skip)

	_validateResourcesTotalCpuMin1000: (
						hasura.resources.compute.cpu+
		auth.resources.compute.cpu+
		storage.resources.compute.cpu+
		postgres.resources.compute.cpu) >= 1000 & true @cuegraph(skip)

	_validateAllResourcesAreSetOrNot: (
						((hasura.resources.compute != _|_) == (auth.resources.compute != _|_)) &&
		((auth.resources.compute != _|_) == (storage.resources.compute != _|_)) &&
		((storage.resources.compute != _|_) == (postgres.resources.compute != _|_))) & true @cuegraph(skip)

	_validateNetworkingMustBeNullOrNotSet: !storage.resources.networking | storage.resources.networking == null @cuegraph(skip)

	_isProviderSMTPSet:                                     provider.smtp != _|_                                                        @cuegraph(skip)
	_isAuthRateLimitEmailsDefault:                          auth.rateLimit.emails.limit == 10 && auth.rateLimit.emails.interval == "1h" @cuegraph(skip)
	_validateAuthRateLimitEmailsIsDefaultOrSMTPSettingsSet: (_isProviderSMTPSet | _isAuthRateLimitEmailsDefault) & true                 @cuegraph(skip)

	_validateOAuth2ProviderRequiresRS256: (
						!auth.oauth2Provider.enabled |
		hasura.jwtSecrets[0].type == "RS256" |
		hasura.jwtSecrets[0].type == "RS384" |
		hasura.jwtSecrets[0].type == "RS512") & true @cuegraph(skip)
}

// Global configuration that applies to all services
#Global: {
	// User-defined environment variables that are spread over all services
	environment: [...#GlobalEnvironmentVariable] | *[]
}

#GlobalEnvironmentVariable: {
	// Name of the environment variable
	name: =~"(?i)^[a-z_]{1,}[a-z0-9_]*" & !~"(?i)^NHOST_" & !~"(?i)^HASURA_"
	// Value of the environment variable
	value: string
}

#Graphql: {
	// Security controls for the GraphQL API.
	security: #GraphqlSecurity
}

#GraphqlSecurity: {
	// Reject requests authenticated with the admin secret.
	forbidAminSecret: bool | *false
	// Maximum allowed depth of a GraphQL query.
	maxDepthQueries: uint | *0 // 0 disables the check
}

#Networking: {
	// Ingress rules exposing the service.
	ingresses: [#Ingress] | *[]
}

#Ingress: {
	// Fully-qualified domain names for the ingress.
	fqdn: [string & net.FQDN & strings.MinRunes(1) & strings.MaxRunes(63)]

	// TLS configuration for the ingress.
	tls?: {
		// Client certificate authority for mutual TLS.
		clientCA?: string
	}
}

#Autoscaler: {
	// Maximum number of replicas the autoscaler may create.
	maxReplicas: uint8 & >=2 & <=100
}

// Resource configuration for a service
#Resources: {
	// CPU and memory allocation.
	compute?: #ResourcesCompute

	// Number of replicas for a service
	replicas: uint8 & >=1 & <=10 | *1

	// Automatic replica scaling settings.
	autoscaler?: #Autoscaler

	_validateReplicasMustBeSmallerThanMaxReplicas: (replicas <= autoscaler.maxReplicas) & true @cuegraph(skip)

	_validateMultipleReplicasNeedsCompute: (
						replicas == 1 && autoscaler == _|_ |
							compute != _|_) & true @cuegraph(skip)
	_validateMultipleReplicasRatioMustBe1For2: (
							replicas == 1 && autoscaler == _|_ |
		(compute.cpu*2.048 == compute.memory)) & true @cuegraph(skip)

	// Network exposure and ingress configuration.
	networking?: #Networking | null
}

#ResourcesCompute: {
	// milicpus, 1000 milicpus = 1 cpu
	cpu: uint32 & >=250 & <=30000
	// MiB: 128MiB to 30GiB
	memory: uint32 & >=128 & <=62464

	// validate CPU steps of 250 milicpus
	_validateCPUSteps250: (mod(cpu, 250) == 0) & true @cuegraph(skip)

	// validate memory steps of 128 MiB
	_validateMemorySteps128: (mod(memory, 128) == 0) & true @cuegraph(skip)
}

// Configuration for hasura service
#Hasura: {
	// Version of hasura, you can see available versions in the URL below:
	// https://hub.docker.com/r/hasura/graphql-engine/tags
	version: string | *"v2.48.10-ce"

	// JWT Secrets configuration
	jwtSecrets: [#JWTSecret]

	// Admin secret
	adminSecret: string

	// Webhook secret
	webhookSecret: string

	// Configuration for hasura services
	// Reference: https://hasura.io/docs/latest/deployment/graphql-engine-flags/reference/
	settings: {
		// Comma-separated list of domains allowed to make cross-origin requests.
		corsDomain: [...#Url] | *["*"]
		// Include detailed error messages in API responses (development only).
		devMode: bool | *true
		// Restrict execution to queries in the allowlist.
		enableAllowList: bool | *false
		// Serve the web console for managing the GraphQL API.
		enableConsole: bool | *true
		// Enforce role-based permissions on remote schemas.
		enableRemoteSchemaPermissions: bool | *false
		// Comma-separated list of APIs to expose (e.g. metadata, graphql).
		enabledAPIs: [...#HasuraAPIs] | *["metadata", "graphql", "pgdump", "config"]

		// Automatically infer permissions for custom SQL functions.
		inferFunctionPermissions: bool | *true

		// How often, in milliseconds, live queries are refetched.
		liveQueriesMultiplexedRefetchInterval: uint32 | *1000

		// Return numeric and bigint values as strings to avoid precision loss.
		stringifyNumericTypes: bool | *false
	}

	// Webhook used to authenticate GraphQL requests.
	authHook?: {
		// URL of the webhook used to authenticate requests.
		url: string

		// HTTP method used to call the auth webhook (GET or POST).
		mode: "GET" | *"POST"

		// Forward the request body to the auth webhook.
		sendRequestBody: bool | *true
	}

	// Logging configuration for the service.
	logs: {
		// Minimum severity of log messages to emit.
		level: "debug" | "info" | "error" | *"warn"
	}

	// Event delivery configuration.
	events: {
		// Maximum number of concurrent HTTP connections used to deliver events.
		httpPoolSize: uint32 & >=1 & <=100 | *100
	}

	// Resources for the service
	resources?: #Resources

	// Rate limiting applied to the service.
	rateLimit?: #RateLimit
}

// APIs for hasura
#HasuraAPIs: "metadata" | "graphql" | "pgdump" | "config"

// Configuration for storage service
#Storage: {
	// Version of storage service, you can see available versions in the URL below:
	// https://hub.docker.com/r/nhost/hasura-storage/tags
	//
	// Releases:
	//
	// https://github.com/nhost/hasura-storage/releases
	version: string | *"0.14.0"

	// Networking (custom domains at the moment) are not allowed as we need to do further
	// configurations in the CDN. We will enable it again in the future.
	resources?: #Resources & {networking?: null}

	// Antivirus scanning for uploaded files.
	antivirus?: {
		// Address of the antivirus (ClamAV) server.
		server: "tcp://run-clamav:3310"
	}

	// Bounds applied to on-the-fly image transformations to keep a single
	// request from exhausting the service's memory/CPU. Omit to use the
	// storage service's built-in defaults.
	imageTransformer?: {
		// Maximum width or height, in pixels, an image may be resized to.
		maxImageOutputDimension: uint32 & >=1 | *8000

		// Maximum Gaussian blur sigma that may be applied to an image.
		maxBlurSigma: uint32 & >=1 | *250
	}

	// Rate limiting applied to the service.
	rateLimit?: #RateLimit
}

// Configuration for functions service
#Functions: {
	// Node.js runtime configuration for functions.
	node: {
		// Node.js major version used to run functions.
		version: 22 | *24 | 26
	}

	// Networking configuration for the functions service.
	resources?: {
		// Network exposure and ingress configuration.
		networking?: #Networking
	}

	// Rate limiting applied to the service.
	rateLimit?: #RateLimit
}

// Configuration for postgres service
#Postgres: {
	// Version of postgres, you can see available versions in the URL below:
	// https://hub.docker.com/r/nhost/postgres/tags
	version: string | *"14.20-20251217-1"

	// Resources for the service
	resources: {
		// CPU and memory allocation.
		compute?: #ResourcesCompute
		// Persistent disk storage.
		storage: {
			// Storage capacity, in gigabytes.
			capacity: uint32 & >=1 & <=4000 // GiB
		}

		// Number of service replicas to run.
		replicas?: 1

		// Expose the database on a public endpoint.
		enablePublicAccess?: bool | *false

		// CIDR prefixes for IP-based access control.
		// When set, only connections from these CIDRs are allowed.
		// When unset, all IPs are allowed.
		// Only effective when enablePublicAccess is true.
		allowedCIDRs?: [...net.IPCIDR] & list.MaxItems(3)
	}

	// Advanced configuration settings for the service.
	settings?: {
		// Enable just-in-time compilation of queries.
		jit: "off" | "on" | *"on"
		// Maximum number of concurrent database connections.
		maxConnections: int32 | *100
		// Memory dedicated to the shared buffer cache.
		sharedBuffers: string | *"128MB"
		// Planner estimate of memory available for disk caching.
		effectiveCacheSize: string | *"4GB"
		// Memory used for maintenance operations such as VACUUM.
		maintenanceWorkMem: string | *"64MB"
		// Target fraction of the checkpoint interval over which to spread writes.
		checkpointCompletionTarget: number | *0.9
		// Memory used for write-ahead log buffers.
		walBuffers: string | *"-1"
		// Default sample size for table statistics.
		defaultStatisticsTarget: int32 | *100
		// Planner's estimated cost of a non-sequential disk page fetch.
		randomPageCost: number | *4.0
		// Number of concurrent disk I/O operations the planner expects.
		effectiveIOConcurrency: int32 | *1
		// Memory used per query operation before spilling to disk.
		workMem: string | *"4MB"
		// Whether to use huge memory pages.
		hugePages: string | *"try"
		// Minimum size to shrink the write-ahead log to.
		minWalSize: string | *"80MB"
		// Maximum write-ahead log size before a checkpoint is triggered.
		maxWalSize: string | *"1GB"
		// Maximum number of background worker processes.
		maxWorkerProcesses: int32 | *8
		// Maximum parallel workers per Gather node.
		maxParallelWorkersPerGather: int32 | *2
		// Maximum parallel workers across the system.
		maxParallelWorkers: int32 | *8
		// Maximum parallel workers for maintenance operations.
		maxParallelMaintenanceWorkers: int32 | *2
		// Amount of information written to the write-ahead log.
		walLevel: string | *"replica"
		// Maximum number of concurrent WAL sender processes.
		maxWalSenders: int32 | *10
		// Maximum number of replication slots.
		maxReplicationSlots: int32 | *10
		// Force a WAL segment switch after this many seconds.
		archiveTimeout: int32 & >=300 & <=1073741823 | *300
		// Collect timing statistics for disk I/O.
		trackIoTiming: "on" | *"off"

		// if pitr is on we need walLevel to set to replica or logical
		_validateWalLevelIsLogicalOrReplicaIfPitrIsEnabled: ( pitr == _|_ | walLevel == "replica" | walLevel == "logical") & true @cuegraph(skip)
	}

	// Point-in-time recovery settings.
	pitr?: {
		// Number of days to retain backups.
		retention: uint8 & 7
	}
}

// Configuration for auth service
// You can find more information about the configuration here:
// https://github.com/nhost/hasura-auth/blob/main/docs/environment-variables.md
#Auth: {
	// Version of auth, you can see available versions in the URL below:
	// https://hub.docker.com/r/nhost/hasura-auth/tags
	//
	// Releases:
	//
	// https://github.com/nhost/hasura-auth/releases
	version: string | *"0.49.1"

	// Resources for the service
	resources?: #Resources

	// Settings for elevated-privilege operations.
	elevatedPrivileges: {
		// How elevated privileges are granted.
		mode: "recommended" | "required" | *"disabled"
	}

	// Allowed post-authentication redirect URLs.
	redirections: {
		// URL of your frontend application, used for post-authentication redirects.
		clientUrl: #Url | *"http://localhost:3000"
		// Additional URLs permitted as post-authentication redirect targets.
		allowedUrls: [...string]
	}

	// User sign-up settings.
	signUp: {
		// Allow new users to sign up.
		enabled: bool | *true

		// Block newly registered users from signing in until activated.
		disableNewUsers: bool | *false

		// Require explicit account creation instead of signing users up on first login.
		disableAutoSignup: bool | *false

		// Cloudflare Turnstile bot-protection settings.
		turnstile?: {
			// Secret key used to verify Turnstile tokens.
			secretKey: string
		}
	}

	// Default settings applied to users.
	user: {
		// Default and allowed roles for users.
		roles: {
			// Default role assigned to new users.
			default: #UserRole | *"user"
			// Roles a user is allowed to assume.
			allowed: [...#UserRole] | *[default, "me"]
		}
		// Default and allowed locales for users.
		locale: {
			// Default locale used for emails and messages.
			default: #Locale | *"en"
			// Locales users are allowed to select.
			allowed: [...#Locale] | *[default]
		}

		// Gravatar avatar settings.
		gravatar: {
			// Use Gravatar to provide default user avatars.
			enabled: bool | *true
			// Fallback Gravatar image used when a user has none.
			default: "404" | "mp" | "identicon" | "monsterid" | "wavatar" | "retro" | "robohash" | *"blank"
			// Maximum Gravatar content rating to allow.
			rating: "pg" | "r" | "x" | *"g"
		}
		// Restrictions on which email addresses may sign up.
		email: {
			// Email addresses permitted to sign up.
			allowed: [...#Email]
			// Email addresses blocked from signing up.
			blocked: [...#Email]

		}
		// Allowed and blocked email domains for sign-up.
		emailDomains: {
			// Email domains permitted to sign up.
			allowed: [...string & net.FQDN]
			// Email domains blocked from signing up.
			blocked: [...string & net.FQDN]
		}
	}

	// Access and refresh token settings.
	session: {
		// Access token settings.
		accessToken: {
			// Lifetime of an access token, in seconds.
			expiresIn: uint32 | *900
			// Custom claims added to the JWT, mapped from the session and database.
			customClaims: [...{
				key:      =~"[a-zA-Z_]{1,}[a-zA-Z0-9_]*"
				value:    string
				default?: string
			}] | *[]
		}

		// Refresh token settings.
		refreshToken: {
			// Lifetime of a refresh token, in seconds.
			expiresIn: uint32 | *2592000
		}

	}

	// Available authentication methods.
	method: {
		// Anonymous (guest) sign-in.
		anonymous: {
			// Enable this feature.
			enabled: bool | *false
		}

		// Passwordless sign-in via email magic link.
		emailPasswordless: {
			// Enable this feature.
			enabled: bool | *false
		}

		// One-time password (OTP) sign-in.
		otp: {
			// Enable one-time-password sign-in over email.
			email: {
				// Enable this feature.
				enabled: bool | *false
			}
		}

		// Email and password sign-in.
		emailPassword: {
			// Reject passwords found in known data breaches (Have I Been Pwned).
			hibpEnabled: bool | *false
			// Require users to verify their email before signing in.
			emailVerificationRequired: bool | *true
			// Minimum allowed password length.
			passwordMinLength: uint8 & >=3 | *9
		}

		// Passwordless sign-in via SMS.
		smsPasswordless: {
			// Enable this feature.
			enabled: bool | *false
		}

		// OAuth social sign-in providers.
		oauth: {
			// Apple OAuth provider.
			apple: {
				// Enable this feature.
				enabled: bool | *false
				if enabled {
					// OAuth client ID.
					clientId: string
					// Apple key ID.
					keyId: string
					// Apple team ID.
					teamId: string
					// Apple private key.
					privateKey: string
				}
				if !enabled {
					clientId?:   string
					keyId?:      string
					teamId?:     string
					privateKey?: string
				}

				// Expected audience claim for the provider's tokens.
				audience?: string
				// OAuth scopes requested from the provider.
				scope?: [...string]
			}
			// Azure AD OAuth provider.
			azuread: {
				#StandardOauthProvider

				// Directory (tenant) ID for the provider.
				tenant: string | *"common"
			}
			// Bitbucket OAuth provider.
			bitbucket: #StandardOauthProvider
			// Discord OAuth provider.
			discord: #StandardOauthProviderWithScope
			// Microsoft Entra ID OAuth provider.
			entraid: {
				#StandardOauthProvider

				// Directory (tenant) ID for the provider.
				tenant: string | *"common"
			}
			// Facebook OAuth provider.
			facebook: #StandardOauthProviderWithScope
			// GitHub OAuth provider.
			github: #StandardOauthProviderWithScope
			// GitLab OAuth provider.
			gitlab: #StandardOauthProviderWithScope
			// Google OAuth provider.
			google: #StandardOauthProviderWithScope
			// LinkedIn OAuth provider.
			linkedin: #StandardOauthProviderWithScope
			// Spotify OAuth provider.
			spotify: #StandardOauthProviderWithScope
			// Strava OAuth provider.
			strava: #StandardOauthProviderWithScope
			// Twitch OAuth provider.
			twitch: #StandardOauthProviderWithScope
			// Twitter (X) OAuth provider.
			twitter: {
				// Enable this feature.
				enabled: bool | *false
				if enabled {
					// Twitter (X) consumer key.
					consumerKey: string
					// Twitter (X) consumer secret.
					consumerSecret: string
				}
				if !enabled {
					consumerKey?:    string
					consumerSecret?: string
				}
			}
			// Microsoft account (Windows Live) OAuth provider.
			windowslive: #StandardOauthProviderWithScope
			// WorkOS OAuth provider.
			workos: {
				#StandardOauthProvider

				// Specific connection to use for the provider.
				connection?: string
				// Organization identifier for the provider.
				organization?: string
			}
		}

		// WebAuthn / passkey sign-in.
		webauthn: {
			// Enable this feature.
			enabled: bool | *false
			// WebAuthn relying party settings.
			relyingParty?: {
				// Relying party identifier (typically your domain).
				id: string | *""
				// Human-readable relying party name.
				name?: string
				// Allowed origins for WebAuthn ceremonies.
				origins?: [...#Url] | *[redirections.clientUrl]
			}
			// WebAuthn attestation conveyance settings.
			attestation: {
				// Timeout, in milliseconds, for WebAuthn ceremonies.
				timeout: uint32 | *60000
			}
		}
	}

	// Time-based one-time password (TOTP) authentication.
	totp: {
		// Enable this feature.
		enabled: bool | *false
		if enabled {
			// TOTP issuer name shown in authenticator apps.
			issuer: string
		}
		if !enabled {
			issuer?: string
		}
	}

	// Settings for acting as an OAuth 2.0 provider.
	oauth2Provider: {
		// Enable this feature.
		enabled: bool | *false
		if enabled {
			// URL of your login page for the OAuth 2.0 authorization flow.
			loginURL: string
		}
		if !enabled {
			loginURL?: string
		}

		// Access token settings.
		accessToken: {
			// Token lifetime, in seconds.
			expiresIn: uint32 | *900
		}
		// Refresh token settings.
		refreshToken: {
			// Token lifetime, in seconds.
			expiresIn: uint32 | *2592000
		}
		// Client ID metadata document settings.
		clientIdMetadataDocument: {
			// Enable this feature.
			enabled: bool | *false
		}
	}

	// Miscellaneous authentication settings.
	misc: {
		// Hide detailed error messages from API responses.
		concealErrors: bool | *false
	}

	// Rate limiting applied to the service.
	rateLimit: #AuthRateLimit
}

#RateLimit: {
	// Maximum number of requests allowed per interval.
	limit: uint32
	// Length of the rate-limit window.
	interval: string & time.Duration
}

#AuthRateLimit: {
	// Rate limit for outgoing emails.
	emails: #RateLimit | *{limit: 10, interval: "1h"}
	// Rate limit for outgoing SMS messages.
	sms: #RateLimit | *{limit: 10, interval: "1h"}
	// Rate limit to mitigate brute-force attacks.
	bruteForce: #RateLimit | *{limit: 10, interval: "5m"}
	// Rate limit for new sign-ups.
	signups: #RateLimit | *{limit: 10, interval: "5m"}
	// Global rate limit applied across all auth endpoints.
	global: #RateLimit | *{limit: 100, interval: "1m"}
	// Rate limit for OAuth 2.0 server endpoints.
	oauth2Server: #RateLimit | *{limit: 100, interval: "5m"}
}

#StandardOauthProvider: {
	// Enable this feature.
	enabled: bool | *false
	if enabled {
		// OAuth client ID.
		clientId: string
		// OAuth client secret.
		clientSecret: string
	}
	if !enabled {
		clientId?:     string
		clientSecret?: string
	}
}

#StandardOauthProviderWithScope: {
	// Enable this feature.
	enabled: bool | *false
	if enabled {
		// OAuth client ID.
		clientId: string
		// OAuth client secret.
		clientSecret: string
	}
	if !enabled {
		clientId?:     string
		clientSecret?: string
	}

	// Expected audience claim for the provider's tokens.
	audience?: string
	// OAuth scopes requested from the provider.
	scope?: [...string]
}

#Provider: {
	// SMTP server used to send emails.
	smtp?: #Smtp
	// SMS provider configuration.
	sms?: #Sms
}

#Smtp: {
	host:     "postmark"
	password: string
	sender:   string
	// these are needed for backwards compatibility, they're actually ignored
	user?:   string
	port?:   #Port
	secure?: bool
	method?: "LOGIN" | "CRAM-MD5" | "PLAIN"
} | {
	user:     string
	password: string
	sender:   string
	host:     string & !="postmark" & (net.FQDN | net.IP)
	port:     #Port
	secure:   bool
	method:   "LOGIN" | "CRAM-MD5" | "PLAIN"
}

#Sms: {
	// SMS provider to use.
	provider: "twilio"
	// Provider account SID.
	accountSid: string
	// Provider auth token.
	authToken: string
	// Provider messaging service ID.
	messagingServiceId: string
}

#UserRole: string
#Url:      string
#Port:     uint16
#Email:    =~"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
#Locale:   string & strings.MinRunes(2) & strings.MaxRunes(3)

// Signing key and configuration used to verify JSON Web Tokens.
// See [JSON Web Tokens](/products/auth/jwt) for the full configuration and examples.
#JWTSecret:
	({
		type: "HS384" | "HS512" | *"HS256"
		key:  string
	} |
	{
		type:        "RS256" | "RS384" | "RS512"
		key:         string
		signingKey?: string
		kid?:        string
	} |
	{
		jwk_url: #Url | *null
	}) &
	{
		claims_format?: "stringified_json" | *"json"
		audience?:      string
		issuer?:        string
		allowed_skew?:  uint32
		header?:        string
	} & {
		claims_map?: [...#ClaimMap]

	} &
	({
		claims_namespace: string | *"https://hasura.io/jwt/claims"
	} |
	{
		claims_namespace_path: string
	} | *{})

#ClaimMap: {
	claim: string
	{
		value: string
	} | {
		path:     string
		default?: string
	}
} & {}

#SystemConfig: {
	auth: {
		email: {
			templates: {
				s3Key?: string
			}
		}
	}

	graphql: {
		// manually enable graphi on a per-service basis
		// by default it follows the plan
		featureAdvancedGraphql: bool | *false
	}

	postgres: {
		enabled:      bool | *true
		majorVersion: "14" | "15" | "16" | "17" | "18" | *"14"
		if enabled {
			database: string
		}
		if !enabled {
			database?: string
		}
		connectionString: {
			backup:  string
			hasura:  string
			auth:    string
			storage: string
		}

		disk?: {
			iops: uint32 | *3000
			tput: uint32 | *125
		}

		encryptColumnKey?:    string & =~"^[0-9a-fA-F]{64}$" // 32 bytes hex-encoded key
		oldEncryptColumnKey?: string & =~"^[0-9a-fA-F]{64}$" // for key rotation
	}

	persistentVolumesEncrypted: bool | *false
}

#Experimental: {
	// Constellation GraphQL engine settings.
	constellation?: #Constellation
}

#Constellation: {
	// Version of constellation, you can see available versions in the URL below:
	// https://hub.docker.com/r/nhost/constellation/tags
	version: string | *"0.1.0"

	// Advanced configuration settings for the service.
	settings?: {
		// CORS allowed origins. If set, these are used as-is.
		// If unset, origins are derived from auth.redirections.clientUrl and
		// auth.redirections.allowedUrls (paths/queries/fragments stripped).
		corsAllowedOrigins?: [...string]

		// Enable debug logging.
		debug: bool | *false

		// Return raw connector/database error detail to clients instead of
		// the sanitized generic message. For development only — never enable
		// in production, as it leaks internal schema and data values.
		devMode: bool | *false

		// Polling interval for GraphQL subscriptions.
		subscriptionPollInterval: string & time.Duration | *"1s"
	}
}

#AI: {
	// Version of the service image to deploy.
	version: string | *"0.8.1"
	// Compute resources and scaling for the service.
	resources: {
		// CPU and memory allocation.
		compute: #ComputeResources
	}

	// OpenAI API configuration.
	openai: {
		// Organization identifier for the provider.
		organization?: string
		// API key used to authenticate with the service.
		apiKey: string
	}

	// Automatic embeddings generation settings.
	autoEmbeddings: {
		// How often, in minutes, embeddings are synchronized.
		synchPeriodMinutes: uint32 | *5
	}

	// Secret used to authenticate webhook calls.
	webhookSecret: string
}

#Observability: {
	// Grafana dashboards and alerting configuration.
	grafana: #Grafana
}

#Grafana: {
	// Admin password for Grafana.
	adminPassword: string

	// SMTP server used to send emails.
	smtp?: {
		// SMTP server hostname.
		host: string & net.FQDN | net.IP
		// SMTP server port.
		port: #Port
		// From address for outgoing emails.
		sender: string
		// Username for SMTP authentication.
		user: string
		// Password for SMTP authentication.
		password: string
	}

	// Grafana alerting configuration.
	alerting: {
		// Enable this feature.
		enabled: bool | *false
	}

	// Contact points for Grafana alerts.
	contacts: {
		// Email addresses to send alerts to.
		emails?: [...string]
		// PagerDuty alert contact.
		pagerduty?: [...{
			integrationKey: string
			severity:       string
			class:          string
			component:      string
			group:          string
		}]
		// Discord alert contact.
		discord?: [...{
			url:       string
			avatarUrl: string
		}]
		// Slack alert contact.
		slack?: [...{
			recipient: string
			token:     string
			username:  string
			iconEmoji: string
			iconURL:   string
			mentionUsers: [...string]
			mentionGroups: [...string]
			mentionChannel: string
			url:            string
			endpointURL:    string
		}]
		// Webhook alert contact.
		webhook?: [...{
			url:                      string
			httpMethod:               string
			username:                 string
			password:                 string
			authorizationScheme:      string
			authorizationCredentials: string
			maxAlerts:                int
		}]

	}
}

#RunServicePort: {
	port:    #Port
	type:    "http" | "grpc" | "tcp" | "udp"
	publish: bool | *false
	ingresses: [#Ingress] | *[]
	_publish_supported_only_over_http: (
						publish == false || type == "http" || type == "grpc" ) & true @cuegraph(skip)

	rateLimit?: #RateLimit
}

#RunServiceName: =~"^[a-z]([-a-z0-9]*[a-z0-9])?$" & strings.MinRunes(1) & strings.MaxRunes(30)

// Resource configuration for a service
#ComputeResources: {
	// milicpus, 1000 milicpus = 1 cpu
	cpu: uint32 & >=62 & <=14000
	// MiB: 128MiB to 30GiB
	memory: uint32 & >=128 & <=28720

	// validate memory steps of 128 MiB
	_validateMemorySteps128: (mod(memory, 128) == 0) & true @cuegraph(skip)
}

// Resource configuration for a service
#RunServiceResources: {
	compute: #ComputeResources

	storage: [...{
		name:     #RunServiceName       // name of the volume, changing it will cause data loss
		capacity: uint32 & >=1 & <=1000 // GiB
		path:     string
	}] | *[]
	_storage_name_must_be_unique: list.UniqueItems([for s in storage {s.name}]) & true @cuegraph(skip)
	_storage_path_must_be_unique: list.UniqueItems([for s in storage {s.path}]) & true @cuegraph(skip)

	// Number of replicas for a service
	replicas: uint8 & <=10

	autoscaler?: #Autoscaler

	_validateReplicasMustBeSmallerThanMaxReplicas: (replicas <= autoscaler.maxReplicas) & true @cuegraph(skip)

	_replcas_cant_be_greater_than_1_when_using_storage: (len(storage) == 0 | (len(storage) > 0 & replicas <= 1 && autoscaler == _|_)) & true @cuegraph(skip)

	_validate_cpu_memory_ratio_must_be_1_for_2: (math.Abs(compute.memory-compute.cpu*2.048) <= 1.024) & true @cuegraph(skip)
}

#RunServiceImage: {
	image: string
	// content of "auths", i.e., { "auths": $THIS }
	pullCredentials?: string
}

#HealthCheck: {
	port:                #Port
	initialDelaySeconds: int | *30
	probePeriodSeconds:  int | *60
}

#EnvironmentVariable: {
	// Name of the environment variable
	name: =~"(?i)^[a-z_]{1,}[a-z0-9_]*"
	// Value of the environment variable
	value: string
}

#RunServiceConfig: {
	name:  #RunServiceName
	image: #RunServiceImage
	command: [...string]
	environment: [...#EnvironmentVariable] | *[]
	ports?: [...#RunServicePort] | *[]
	resources:    #RunServiceResources
	healthCheck?: #HealthCheck
}
