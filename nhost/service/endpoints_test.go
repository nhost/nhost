package service_test

import (
	"bytes"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/nhost/service"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestEndpoints_Dump(t *testing.T) {
	assert := assert.New(t)
	p := ports.NewPorts(
		ports.DefaultProxyPort,
		ports.DefaultSSLProxyPort,
		ports.DefaultDBPort,
		ports.DefaultGraphQLPort,
		ports.DefaultHasuraConsolePort,
		ports.DefaultHasuraConsoleApiPort,
		ports.DefaultSMTPPort,
		ports.DefaultS3MinioPort,
	)
	dcConf := compose.NewConfig(&nhost.Configuration{}, p, []string{}, "", "")
	endpoints := service.NewEndpoints(
		dcConf.PublicPostgresConnectionString(),
		dcConf.PublicHasuraGraphqlEndpoint(),
		dcConf.PublicHasuraEndpoint(),
		dcConf.PublicAuthConnectionString(),
		dcConf.PublicStorageConnectionString(),
		dcConf.PublicFunctionsConnectionString(),
		dcConf.PublicHasuraConsoleRedirectURL(),
		dcConf.PublicDashboardURL(),
		dcConf.PublicMailhogURL(),
	)

	output := &bytes.Buffer{}
	endpoints.Dump(output)

	assert.Equal(`

URLs:
- Postgres:		postgres://postgres:postgres@local.db.nhost.run:5432/postgres
- Hasura:		https://local.hasura.nhost.run
- GraphQL:		https://local.graphql.nhost.run/v1
- Auth:			https://local.auth.nhost.run/v1
- Storage:		https://local.storage.nhost.run/v1
- Functions:		https://local.functions.nhost.run/v1

- Dashboard:		https://local.dashboard.nhost.run
- Hasura Console:	https://local.hasura.nhost.run/console
- Mailhog:		https://local.mailhog.nhost.run

- subdomain:		local
- region:		(empty)

`, output.String())
}
