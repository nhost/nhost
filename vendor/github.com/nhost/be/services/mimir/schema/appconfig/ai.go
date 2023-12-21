package appconfig

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func AIEnv(
	config *model.ConfigConfig,
	nhostGraphqlURL string,
	postgresConnection string,
) []EnvVar {
	env := []EnvVar{
		{
			Name:  "OPENAI_API_KEY",
			Value: config.GetAi().GetOpenai().GetApiKey(),
		},
		{
			Name:  "OPENAI_ORG",
			Value: unptr(config.GetAi().GetOpenai().GetOrganization()),
		},
		{
			Name:  "GRAPHITE_WEBHOOK_SECRET",
			Value: config.GetAi().GetWebhookSecret(),
		},
		{
			Name:  "GRAPHITE_BASE_URL",
			Value: "http://ai:8090",
		},
		{
			Name: "SYNCH_PERIOD",
			Value: fmt.Sprintf(
				"%dm", unptr(config.GetAi().GetAutoEmbeddings().GetSynchPeriodMinutes()),
			),
		},
		{
			Name:  "NHOST_GRAPHQL_URL",
			Value: nhostGraphqlURL,
		},
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: config.GetHasura().GetAdminSecret(),
		},
		{
			Name:  "POSTGRES_CONNECTION",
			Value: postgresConnection,
		},
	}

	for _, e := range config.GetGlobal().GetEnvironment() {
		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  e.Name,
			Value: e.Value,
		})
	}
	return env
}
