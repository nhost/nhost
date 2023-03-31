package service_test

import (
	"bytes"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/config"
	"github.com/nhost/cli/internal/ports"
	"github.com/nhost/cli/nhost/compose"
	"github.com/nhost/cli/nhost/service"
	"github.com/stretchr/testify/assert"
	"testing"
)

func resolvedDefaultConfig(t *testing.T) *model.ConfigConfig {
	t.Helper()
	c, secr, err := config.DefaultConfigAndSecrets()
	if err != nil {
		t.Fatal(err)
	}

	c, err = config.ValidateAndResolve(c, secr)
	if err != nil {
		t.Fatal(err)
	}

	return c
}

func TestEndpoints_Dump(t *testing.T) {
	assert := assert.New(t)
	p := ports.NewPorts(
		ports.DefaultProxyPort,
		ports.DefaultSSLProxyPort,
		ports.DefaultDBPort,
		ports.DefaultGraphQLPort,
		ports.DefaultHasuraConsolePort,
		ports.DefaultHasuraConsoleAPIPort,
		ports.DefaultSMTPPort,
		ports.DefaultS3MinioPort,
		ports.DefaultDashboardPort,
		ports.DefaultMailhogPort,
	)
	dcConf := compose.NewConfig(resolvedDefaultConfig(t), p, "", "")
	endpoints := service.NewEndpoints(
		dcConf.PublicPostgresConnectionString(),
		dcConf.PublicHasuraGraphqlEndpoint(),
		dcConf.PublicHasuraEndpoint(),
		dcConf.PublicAuthConnectionString(),
		dcConf.PublicStorageConnectionString(),
		dcConf.PublicFunctionsConnectionString(),
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

- Dashboard:		http://localhost:3030
- Mailhog:		http://localhost:8025

- subdomain:		local
- region:		(empty)

`, output.String())
}
