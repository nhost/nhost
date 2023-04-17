package config

import (
	"net"
	"strings"
)

#Config: {
	global:    #Global
	hasura:    #Hasura
	functions: #Functions
	auth:      #Auth
	postgres:  #Postgres
	provider:  #Provider
	storage:   #Storage


    _totalResourcesCPU: (
        hasura.resources.replicas*hasura.resources.compute.cpu+
		auth.resources.replicas*auth.resources.compute.cpu+
		storage.resources.replicas*storage.resources.compute.cpu+
		postgres.resources.replicas*postgres.resources.compute.cpu) @cuegraph(skip)

    _totalResourcesMemory: (
        hasura.resources.replicas*hasura.resources.compute.memory+
		auth.resources.replicas*auth.resources.compute.memory+
		storage.resources.replicas*storage.resources.compute.memory+
		postgres.resources.replicas*postgres.resources.compute.memory) @cuegraph(skip)

	_validateResourcesTotalCpuMemoryRatioMustBe1CPUFor2GB: (
        _totalResourcesCPU*2.048 & _totalResourcesMemory*1.0) @cuegraph(skip)

	_validateResourcesTotalCpuMin1000: (
        hasura.resources.compute.cpu+
		auth.resources.compute.cpu+
		storage.resources.compute.cpu+
		postgres.resources.compute.cpu) >= 1000 & true @cuegraph(skip)

    _validateAllResourcesAreSetOrNot: (
        (hasura.resources == _|_) ==
        (auth.resources == _|_) ==
        (storage.resources == _|_) ==
        (postgres.resources == _|_) ) & true @cuegraph(skip)
}

#Global: {
	// User-defined environment variables that are spread over all services
	environment: [...#EnvironmentVariable] | *[]
}

#EnvironmentVariable: {
	name:  =~"(?i)^[a-z_]{1,}[a-z0-9_]*" & !~"(?i)^NHOST_"
	value: string
}

#Resources: {
	compute: {
		// milicpus
		cpu: uint32 & >=250 & <=15000
		// MiB: 128MiB to 30GiB
		memory: uint32 & >=128 & <=30720

		// validate CPU steps of 250 milicpus
		_validateCPUSteps250: (mod(cpu, 250) == 0) & true @cuegraph(skip)

		// validate memory steps of 128 MiB
		_validateMemorySteps128: (mod(memory, 128) == 0) & true @cuegraph(skip)
	}

	replicas: uint8 & >=1 & <=10
}

#Hasura: {
	version: string | *"v2.15.2"

	jwtSecrets: [#JWTSecret]
	adminSecret:   string
	webhookSecret: string

	settings: {
		enableRemoteSchemaPermissions: bool | *false
	}

	logs: {
		level: "debug" | "info" | "error" | *"warn"
	}

	events: {
		httpPoolSize: uint32 & >=1 & <=100 | *100
	}

	resources?: #Resources
}

#Storage: {
	version:    string | *"0.3.4"
	resources?: #Resources
}

#Functions: {
	node: {
		version: 16
	}
}

#Postgres: {
	version: string | *"14.5-20230104-1"

	resources?: #Resources & {
		replicas: 1
	}
}

#Auth: {
	version: string | *"0.19.1"

	resources?: #Resources

	redirections: {
		clientUrl: #Url | *"http://localhost:3000"
		// We should implement wildcards soon, so the #Url type should not be used here
		allowedUrls: [...string]
	}

	signUp: {
		enabled: bool | *true
	}

	user: {
		roles: {
			default: #UserRole | *"user"
			allowed: [ ...#UserRole] | *[default, "me"]
		}
		locale: {
			default: #Locale | *"en"
			allowed: [...#Locale] | *[default]
		}

		gravatar: {
			enabled: bool | *true
			default: "404" | "mp" | "identicon" | "monsterid" | "wavatar" | "retro" | "robohash" | *"blank"
			rating:  "pg" | "r" | "x" | *"g"
		}
		email: {
			allowed: [...#Email]
			blocked: [...#Email]

		}
		emailDomains: {
			allowed: [...string & net.FQDN]
			blocked: [...string & net.FQDN]
		}
	}

	session: {
		accessToken: {
			expiresIn:    uint32 | *900
			customClaims: [...{
				key:   =~"[a-zA-Z_]{1,}[a-zA-Z0-9_]*"
				value: string
			}] | *[]
		}

		refreshToken: {
			expiresIn: uint32 | *43200
		}

	}

	method: {
		anonymous: {
			enabled: bool | *false
		}

		emailPasswordless: {
			enabled: bool | *false
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
				scope?: [...string]
			}
			azuread: {
				#StandardOauthProvider
				tenant: string | *"common"
			}
			bitbucket: #StandardOauthProvider
			discord:   #StandardOauthProviderWithScope
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
			if enabled {
				relyingParty: {
					name:    string
					origins: [...#Url] | *[redirections.clientUrl]
				}
			}
			if !enabled {
				relyingParty?: {
					name?:    string
					origins?: [...#Url] | *[redirections.clientUrl]
				}
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
	method:   "LOGIN" | "GSSAPI" | "GSSAPI" | "DIGEST-MD5" | "MD5" | "CRAM-MD5" | "OAUTH10A" | "OAUTHBEARER" | "XOAUTH2" | "PLAIN"
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

// * https://hasura.io/docs/latest/auth/authentication/jwt/
#JWTSecret:
	({
		type: "HS384" | "HS512" | "RS256" | "RS384" | "RS512" | "Ed25519" | *"HS256"
		key:  string
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
} & {

}

#SystemConfig: {
	auth: {
		email: {
			templates: {
				s3Key?: string
			}
		}
	}

	postgres: {
		enabled: bool | *true
		if enabled {
			database: string
			password: string
		}
		if !enabled {
			database?: string
			password?: string
		}
		connectionString: {
			backup:  string
			hasura:  string
			auth:    string
			storage: string
		}
	}
}
