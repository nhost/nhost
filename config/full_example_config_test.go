package config_test

import (
	"testing"

	"github.com/nhost/cli/config"
	"github.com/stretchr/testify/assert"
)

func TestFullExampleConfig(t *testing.T) {
	t.Parallel()

	assert := assert.New(t)
	expectedConfig := `[global]
[[global.environment]]
name = 'STRIPE_SECRET_KEY'
value = '{{ secrets.stripe_secret_key }}'

[hasura]
version = 'v2.15.2'
adminSecret = '{{ secrets.HASURA_GRAPHQL_ADMIN_SECRET }}'
webhookSecret = '{{ secrets.NHOST_WEBHOOK_SECRET }}'

[[hasura.jwtSecrets]]
type = 'HS256'
key = '{{ secrets.HASURA_GRAPHQL_JWT_SECRET }}'

[hasura.settings]
enableRemoteSchemaPermissions = false

[hasura.logs]
level = 'warn'

[hasura.events]
httpPoolSize = 100

[hasura.resources]
replicas = 1

[hasura.resources.compute]
cpu = 500
memory = 1024

[functions]
[functions.node]
version = 16

[auth]
version = '0.19.1'

[auth.resources]
replicas = 1

[auth.resources.compute]
cpu = 500
memory = 1024

[auth.redirections]
clientUrl = 'http://localhost:3000'
allowedUrls = ['https://example.com']

[auth.signUp]
enabled = true

[auth.user]
[auth.user.roles]
default = 'user'
allowed = ['user', 'me']

[auth.user.locale]
default = 'en'
allowed = ['en']

[auth.user.gravatar]
enabled = true
default = 'blank'
rating = 'g'

[auth.user.email]
allowed = ['allowed@person.com']
blocked = ['blocked@person.com']

[auth.user.emailDomains]
allowed = ['allowed.com']
blocked = ['blocked.com']

[auth.session]
[auth.session.accessToken]
expiresIn = 900

[[auth.session.accessToken.customClaims]]
key = 'aaabbbccc'
value = 'vvv'

[auth.session.refreshToken]
expiresIn = 43200

[auth.method]
[auth.method.anonymous]
enabled = false

[auth.method.emailPasswordless]
enabled = false

[auth.method.emailPassword]
hibpEnabled = false
emailVerificationRequired = true
passwordMinLength = 9

[auth.method.smsPasswordless]
enabled = false

[auth.method.oauth]
[auth.method.oauth.apple]
enabled = false
clientId = 'client-id'
keyId = 'key-id'
teamId = 'team-id'
scope = ['email', 'name']
privateKey = 'private-key'

[auth.method.oauth.azuread]
tenant = 'common'
enabled = false
clientId = 'client-id'
clientSecret = 'client-secret'

[auth.method.oauth.bitbucket]
enabled = false
clientId = 'client-id'
clientSecret = 'client-secret'

[auth.method.oauth.discord]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.facebook]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.github]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.gitlab]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.google]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.linkedin]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.spotify]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.strava]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.twitch]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.twitter]
enabled = false
consumerKey = 'key'
consumerSecret = 'secret'

[auth.method.oauth.windowslive]
enabled = false
clientId = 'client-id'
scope = ['scope1', 'scope2']
clientSecret = 'client-secret'

[auth.method.oauth.workos]
connection = 'workos-connection'
enabled = false
clientId = 'client-id'
organization = 'workos-org'
clientSecret = 'client-secret'

[auth.method.webauthn]
enabled = false

[auth.method.webauthn.relyingParty]
name = 'party-name'
origins = ['https://example.com']

[auth.method.webauthn.attestation]
timeout = 60000

[auth.totp]
enabled = false
issuer = 'issuer'

[postgres]
version = '14.5-20230104-1'

[postgres.resources]
replicas = 1

[postgres.resources.compute]
cpu = 500
memory = 1024

[provider]
[provider.smtp]
user = 'user'
password = 'password'
sender = 'hasura-auth@example.com'
host = 'mailhog'
port = 1025
secure = false
method = 'PLAIN'

[provider.sms]
provider = 'twilio'
accountSid = 'account-sid'
authToken = 'auth-token'
messagingServiceId = 'messaging-service-id'

[storage]
version = '0.3.4'

[storage.resources]
replicas = 1

[storage.resources.compute]
cpu = 500
memory = 1024
`

	fullExampleConf, err := config.FullExampleConfig()
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(expectedConfig, string(fullExampleConf))
}
