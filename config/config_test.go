package config_test

import (
	"fmt"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/util"
	"github.com/pelletier/go-toml/v2"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestDefaultConfigAndSecrets(t *testing.T) {
	t.Parallel()

	assert := assert.New(t)
	defaultConf, defaultSecrets, err := config.DefaultConfigAndSecrets()
	if err != nil {
		t.Fatal(err)
	}

	defaultConfData, err := config.MarshalFunc(defaultConf)
	if err != nil {
		t.Fatal(err)
	}

	expectedSecrets := fmt.Sprintf(`HASURA_GRAPHQL_ADMIN_SECRET=%s
HASURA_GRAPHQL_JWT_SECRET=%s
NHOST_WEBHOOK_SECRET=%s
`, util.ADMIN_SECRET, util.JWT_KEY, util.WEBHOOK_SECRET)

	expectedConf := `[global]

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

[functions]
[functions.node]
version = 16

[auth]
version = '0.19.1'

[auth.redirections]
clientUrl = 'http://localhost:3000'

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

[auth.user.emailDomains]

[auth.session]
[auth.session.accessToken]
expiresIn = 900

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

[auth.method.oauth.azuread]
tenant = 'common'
enabled = false

[auth.method.oauth.bitbucket]
enabled = false

[auth.method.oauth.discord]
enabled = false

[auth.method.oauth.facebook]
enabled = false

[auth.method.oauth.github]
enabled = false

[auth.method.oauth.gitlab]
enabled = false

[auth.method.oauth.google]
enabled = false

[auth.method.oauth.linkedin]
enabled = false

[auth.method.oauth.spotify]
enabled = false

[auth.method.oauth.strava]
enabled = false

[auth.method.oauth.twitch]
enabled = false

[auth.method.oauth.twitter]
enabled = false

[auth.method.oauth.windowslive]
enabled = false

[auth.method.oauth.workos]
enabled = false

[auth.method.webauthn]
enabled = false

[auth.method.webauthn.attestation]
timeout = 60000

[auth.totp]
enabled = false

[postgres]
version = '14.5-20230104-1'

[provider]

[storage]
version = '0.3.4'
`

	assert.Equal(expectedSecrets, string(config.DumpSecrets(defaultSecrets)))
	assert.Equal(expectedConf, string(defaultConfData))
}

func TestDumpSecrets(t *testing.T) {
	t.Parallel()

	secrets := model.Secrets{
		{
			Name:  "HASURA_ADMIN_SECRET",
			Value: "admin-secret",
		},
		{
			Name:  "HASURA_WEBHOOK_SECRET",
			Value: "webhook-secret",
		},
	}

	expected := `HASURA_ADMIN_SECRET=admin-secret
HASURA_WEBHOOK_SECRET=webhook-secret
`

	assert.Equal(t, expected, string(config.DumpSecrets(secrets)))
}

func TestValidateAndResolve(t *testing.T) {
	assert := assert.New(t)
	defaultConf, _, err := config.DefaultConfigAndSecrets()
	if err != nil {
		t.Fatal(err)
	}

	secrets := model.Secrets{
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: `secret with 'single' quotes`,
		},
		{
			Name:  "HASURA_GRAPHQL_JWT_SECRET",
			Value: `secret with "double" quotes`,
		},
		{
			Name:  "NHOST_WEBHOOK_SECRET",
			Value: `secret with 'single' and "double" quotes`,
		},
	}
	expected := `[global]

[hasura]
version = 'v2.15.2'
adminSecret = "secret with 'single' quotes"
webhookSecret = "secret with 'single' and \"double\" quotes"

[[hasura.jwtSecrets]]
type = 'HS256'
key = 'secret with "double" quotes'

[hasura.settings]
enableRemoteSchemaPermissions = false

[hasura.logs]
level = 'warn'

[hasura.events]
httpPoolSize = 100

[functions]
[functions.node]
version = 16

[auth]
version = '0.19.1'

[auth.redirections]
clientUrl = 'http://localhost:3000'

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

[auth.user.emailDomains]

[auth.session]
[auth.session.accessToken]
expiresIn = 900

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

[auth.method.oauth.azuread]
tenant = 'common'
enabled = false

[auth.method.oauth.bitbucket]
enabled = false

[auth.method.oauth.discord]
enabled = false

[auth.method.oauth.facebook]
enabled = false

[auth.method.oauth.github]
enabled = false

[auth.method.oauth.gitlab]
enabled = false

[auth.method.oauth.google]
enabled = false

[auth.method.oauth.linkedin]
enabled = false

[auth.method.oauth.spotify]
enabled = false

[auth.method.oauth.strava]
enabled = false

[auth.method.oauth.twitch]
enabled = false

[auth.method.oauth.twitter]
enabled = false

[auth.method.oauth.windowslive]
enabled = false

[auth.method.oauth.workos]
enabled = false

[auth.method.webauthn]
enabled = false

[auth.method.webauthn.attestation]
timeout = 60000

[auth.totp]
enabled = false

[postgres]
version = '14.5-20230104-1'

[provider]

[storage]
version = '0.3.4'
`
	got, err := config.ValidateAndResolve(defaultConf, secrets)
	if err != nil {
		t.Fatalf("ValidateAndResolve() error = %v", err)
	}

	conf, err := toml.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(expected, string(conf))
}
