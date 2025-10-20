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
	security: #GraphqlSecurity
}

#GraphqlSecurity: {
	forbidAminSecret: bool | *false
	maxDepthQueries:  uint | *0 // 0 disables the check
}

#Networking: {
	ingresses: [#Ingress] | *[]
}

#Ingress: {
	fqdn: [string & net.FQDN & strings.MinRunes(1) & strings.MaxRunes(63)]

	tls?: {
		clientCA?: string
	}
}

#Autoscaler: {
	maxReplicas: uint8 & >=2 & <=100
}

// Resource configuration for a service
#Resources: {
	compute?: #ResourcesCompute

	// Number of replicas for a service
	replicas:    uint8 & >=1 & <=10 | *1
	autoscaler?: #Autoscaler

	_validateReplicasMustBeSmallerThanMaxReplicas: (replicas <= autoscaler.maxReplicas) & true @cuegraph(skip)

	_validateMultipleReplicasNeedsCompute: (
						replicas == 1 && autoscaler == _|_ |
							compute != _|_) & true @cuegraph(skip)
	_validateMultipleReplicasRatioMustBe1For2: (
							replicas == 1 && autoscaler == _|_ |
		(compute.cpu*2.048 == compute.memory)) & true @cuegraph(skip)

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
	version: string | *"v2.48.5-ce"

	// JWT Secrets configuration
	jwtSecrets: [#JWTSecret]

	// Admin secret
	adminSecret: string

	// Webhook secret
	webhookSecret: string

	// Configuration for hasura services
	// Reference: https://hasura.io/docs/latest/deployment/graphql-engine-flags/reference/
	settings: {
		// HASURA_GRAPHQL_CORS_DOMAIN
		corsDomain: [...#Url] | *["*"]
		// HASURA_GRAPHQL_DEV_MODE
		devMode: bool | *true
		// HASURA_GRAPHQL_ENABLE_ALLOWLIST
		enableAllowList: bool | *false
		// HASURA_GRAPHQL_ENABLE_CONSOLE
		enableConsole: bool | *true
		// HASURA_GRAPHQL_ENABLE_REMOTE_SCHEMA_PERMISSIONS
		enableRemoteSchemaPermissions: bool | *false
		// HASURA_GRAPHQL_ENABLED_APIS
		enabledAPIs: [...#HasuraAPIs] | *["metadata", "graphql", "pgdump", "config"]

		// HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS
		inferFunctionPermissions: bool | *true

		// HASURA_GRAPHQL_LIVE_QUERIES_MULTIPLEXED_REFETCH_INTERVAL
		liveQueriesMultiplexedRefetchInterval: uint32 | *1000

		// HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES
		stringifyNumericTypes: bool | *false
	}

	authHook?: {
		// HASURA_GRAPHQL_AUTH_HOOK
		url: string

		// HASURA_GRAPHQL_AUTH_HOOK_MODE
		mode: "GET" | *"POST"

		// HASURA_GRAPHQL_AUTH_HOOK_SEND_REQUEST_BODY
		sendRequestBody: bool | *true
	}

	logs: {
		// HASURA_GRAPHQL_LOG_LEVEL
		level: "debug" | "info" | "error" | *"warn"
	}

	events: {
		// HASURA_GRAPHQL_EVENTS_HTTP_POOL_SIZE
		httpPoolSize: uint32 & >=1 & <=100 | *100
	}

	// Resources for the service
	resources?: #Resources

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
	version: string | *"0.8.2"

	// Networking (custom domains at the moment) are not allowed as we need to do further
	// configurations in the CDN. We will enable it again in the future.
	resources?: #Resources & {networking?: null}

	antivirus?: {
		server: "tcp://run-clamav:3310"
	}

	rateLimit?: #RateLimit
}

// Configuration for functions service
#Functions: {
	node: {
		version: 20 | *22
	}

	resources?: {
		networking?: #Networking
	}

	rateLimit?: #RateLimit
}

// Configuration for postgres service
#Postgres: {
	// Version of postgres, you can see available versions in the URL below:
	// https://hub.docker.com/r/nhost/postgres/tags
	version: string | *"14.18-20250728-1"

	// Resources for the service
	resources: {
        compute?: #ResourcesCompute
		storage: {
			capacity: uint32 & >=1 & <=1000 // GiB
		}

        replicas?: 1

		enablePublicAccess?: bool | *false
	}

	settings?: {
		jit:                           "off" | "on" | *"on"
		maxConnections:                int32 | *100
		sharedBuffers:                 string | *"128MB"
		effectiveCacheSize:            string | *"4GB"
		maintenanceWorkMem:            string | *"64MB"
		checkpointCompletionTarget:    number | *0.9
		walBuffers:                    string | *"-1"
		defaultStatisticsTarget:       int32 | *100
		randomPageCost:                number | *4.0
		effectiveIOConcurrency:        int32 | *1
		workMem:                       string | *"4MB"
		hugePages:                     string | *"try"
		minWalSize:                    string | *"80MB"
		maxWalSize:                    string | *"1GB"
		maxWorkerProcesses:            int32 | *8
		maxParallelWorkersPerGather:   int32 | *2
		maxParallelWorkers:            int32 | *8
		maxParallelMaintenanceWorkers: int32 | *2
		walLevel:                      string | *"replica"
		maxWalSenders:                 int32 | *10
		maxReplicationSlots:           int32 | *10
		archiveTimeout:                int32 & >=300 & <=1073741823 | *300
        trackIoTiming:                 "on" | *"off"

		// if pitr is on we need walLevel to set to replica or logical
		_validateWalLevelIsLogicalOrReplicaIfPitrIsEnabled: ( pitr == _|_ | walLevel == "replica" | walLevel == "logical") & true @cuegraph(skip)
	}

	pitr?: {
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
	version: string | *"0.42.3"

	// Resources for the service
	resources?: #Resources

	elevatedPrivileges: {
		mode: "recommended" | "required" | *"disabled"
	}

	redirections: {
		// AUTH_CLIENT_URL
		clientUrl: #Url | *"http://localhost:3000"
		// AUTH_ACCESS_CONTROL_ALLOWED_REDIRECT_URLS
		allowedUrls: [...string]
	}

	signUp: {
		// Inverse of AUTH_DISABLE_SIGNUP
		enabled: bool | *true

		// AUTH_DISABLE_NEW_USERS
		disableNewUsers: bool | *false

		turnstile?: {
			secretKey: string
		}
	}

	user: {
		roles: {
			// AUTH_USER_DEFAULT_ROLE
			default: #UserRole | *"user"
			// AUTH_USER_DEFAULT_ALLOWED_ROLES
			allowed: [...#UserRole] | *[default, "me"]
		}
		locale: {
			// AUTH_LOCALE_DEFAULT
			default: #Locale | *"en"
			// AUTH_LOCALE_ALLOWED_LOCALES
			allowed: [...#Locale] | *[default]
		}

		gravatar: {
			// AUTH_GRAVATAR_ENABLED
			enabled: bool | *true
			// AUTH_GRAVATAR_DEFAULT
			default: "404" | "mp" | "identicon" | "monsterid" | "wavatar" | "retro" | "robohash" | *"blank"
			// AUTH_GRAVATAR_RATING
			rating: "pg" | "r" | "x" | *"g"
		}
		email: {
			// AUTH_ACCESS_CONTROL_ALLOWED_EMAILS
			allowed: [...#Email]
			// AUTH_ACCESS_CONTROL_BLOCKED_EMAILS
			blocked: [...#Email]

		}
		emailDomains: {
			// AUTH_ACCESS_CONTROL_ALLOWED_EMAIL_DOMAINS
			allowed: [...string & net.FQDN]
			// AUTH_ACCESS_CONTROL_BLOCKED_EMAIL_DOMAINS
			blocked: [...string & net.FQDN]
		}
	}

	session: {
		accessToken: {
			// AUTH_ACCESS_TOKEN_EXPIRES_IN
			expiresIn: uint32 | *900
			// AUTH_JWT_CUSTOM_CLAIMS
			customClaims: [...{
				key:      =~"[a-zA-Z_]{1,}[a-zA-Z0-9_]*"
				value:    string
                default?: string
			}] | *[]
		}

		refreshToken: {
			// AUTH_REFRESH_TOKEN_EXPIRES_IN
			expiresIn: uint32 | *2592000
		}

	}

	method: {
		anonymous: {
			enabled: bool | *false
		}

		emailPasswordless: {
			enabled: bool | *false
		}

		otp: {
			email: {
				enabled: bool | *false
			}
		}

		emailPassword: {
			// Disabling email+password sign in is not implmented yet
			// enabled: bool | *true
			hibpEnabled:               bool | *false
			emailVerificationRequired: bool | *true
			passwordMinLength:         uint8 & >=3 | *9
		}

		smsPasswordless: {
			enabled: bool | *false
		}

		oauth: {
			apple: {
				enabled: bool | *false
				if enabled {
					clientId:   string
					keyId:      string
					teamId:     string
					privateKey: string
				}
				if !enabled {
					clientId?:   string
					keyId?:      string
					teamId?:     string
					privateKey?: string
				}
				audience?: string
				scope?: [...string]
			}
			azuread: {
				#StandardOauthProvider
				tenant: string | *"common"
			}
			bitbucket: #StandardOauthProvider
			discord:   #StandardOauthProviderWithScope
			entraid: {
				#StandardOauthProvider
				tenant: string | *"common"
			}
			facebook:  #StandardOauthProviderWithScope
			github:    #StandardOauthProviderWithScope
			gitlab:    #StandardOauthProviderWithScope
			google:    #StandardOauthProviderWithScope
			linkedin:  #StandardOauthProviderWithScope
			spotify:   #StandardOauthProviderWithScope
			strava:    #StandardOauthProviderWithScope
			twitch:    #StandardOauthProviderWithScope
			twitter: {
				enabled: bool | *false
				if enabled {
					consumerKey:    string
					consumerSecret: string
				}
				if !enabled {
					consumerKey?:    string
					consumerSecret?: string
				}
			}
			windowslive: #StandardOauthProviderWithScope
			workos: {
				#StandardOauthProvider
				connection?:   string
				organization?: string
			}
		}

		webauthn: {
			enabled: bool | *false
			relyingParty?: {
				id:    string | *""
				name?: string
				origins?: [...#Url] | *[redirections.clientUrl]
			}
			attestation: {
				timeout: uint32 | *60000
			}
		}
	}

	totp: {
		enabled: bool | *false
		if enabled {
			issuer: string
		}
		if !enabled {
			issuer?: string
		}
	}

	misc: {
		concealErrors: bool | *false
	}

	rateLimit: #AuthRateLimit
}

#RateLimit: {
	limit:    uint32
	interval: string & time.Duration
}

#AuthRateLimit: {
	emails: #RateLimit | *{limit: 10, interval: "1h"}
	sms: #RateLimit | *{limit: 10, interval: "1h"}
	bruteForce: #RateLimit | *{limit: 10, interval: "5m"}
	signups: #RateLimit | *{limit: 10, interval: "5m"}
	global: #RateLimit | *{limit: 100, interval: "1m"}
}

#StandardOauthProvider: {
	enabled: bool | *false
	if enabled {
		clientId:     string
		clientSecret: string
	}
	if !enabled {
		clientId?:     string
		clientSecret?: string
	}
}

#StandardOauthProviderWithScope: {
	enabled: bool | *false
	if enabled {
		clientId:     string
		clientSecret: string
	}
	if !enabled {
		clientId?:     string
		clientSecret?: string
	}
	audience?: string
	scope?: [...string]
}

#Provider: {
	smtp?: #Smtp
	sms?:  #Sms
}

#Smtp: {
	user:     string
	password: string
	sender:   string
	host:     string & net.FQDN | net.IP
	port:     #Port
	secure:   bool
	method:   "LOGIN" | "CRAM-MD5" | "PLAIN"
}

#Sms: {
	provider:           "twilio"
	accountSid:         string
	authToken:          string
	messagingServiceId: string
}

#UserRole: string
#Url:      string
#Port:     uint16
#Email:    =~"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
#Locale:   string & strings.MinRunes(2) & strings.MaxRunes(2)

// See https://hasura.io/docs/latest/auth/authentication/jwt/
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
		majorVersion: "14" | "15" | "16" | "17" | *"14"
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
	}

	persistentVolumesEncrypted: bool | *false
}

#AI: {
	version: string | *"0.8.0"
	resources: {
		compute: #ComputeResources
	}

	openai: {
		organization?: string
		apiKey:        string
	}

	autoEmbeddings: {
		synchPeriodMinutes: uint32 | *5
	}

	webhookSecret: string
}

#Observability: {
	grafana: #Grafana
}

#Grafana: {
	adminPassword: string

	smtp?: {
		host:     string & net.FQDN | net.IP
		port:     #Port
		sender:   string
		user:     string
		password: string
	}

	alerting: {
		enabled: bool | *false
	}

	contacts: {
		emails?: [...string]
		pagerduty?: [...{
			integrationKey: string
			severity:       string
			class:          string
			component:      string
			group:          string
		}]
		discord?: [...{
			url:       string
			avatarUrl: string
		}]
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
