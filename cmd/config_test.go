package cmd

import (
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/util"
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_anonymizeAppSecrets(t *testing.T) {
	t.Parallel()

	assert := assert.New(t)

	secrets := model.Secrets{
		{
			Name:  "FOO",
			Value: "super_sensitive_value",
		},
		{
			Name:  "BAR",
			Value: "another_sensitive_value",
		},
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: "very_secret_very_graphql",
		},
		{
			Name:  "HASURA_GRAPHQL_JWT_SECRET",
			Value: "x3WkwtZfwF'dFvRc$gIJkE1*%PUWvbVa!RF=N#xgHRbJ",
		},
		{
			Name:  "NHOST_WEBHOOK_SECRET",
			Value: "secret_webhook_secret",
		},
	}

	anonymizedSecrets := anonymizeAppSecrets(secrets)
	assert.Equal(
		model.Secrets{
			{
				Name:  "FOO",
				Value: "FIXME",
			},
			{
				Name:  "BAR",
				Value: "FIXME",
			},
			{
				Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
				Value: util.ADMIN_SECRET,
			},
			{
				Name:  "HASURA_GRAPHQL_JWT_SECRET",
				Value: util.JWT_KEY,
			},
			{
				Name:  "NHOST_WEBHOOK_SECRET",
				Value: util.WEBHOOK_SECRET,
			},
		},
		anonymizedSecrets,
	)
}
