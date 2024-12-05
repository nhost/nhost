package appconfig

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func AIEnv( //nolint:funlen
	config *model.ConfigConfig,
	nhostGraphqlURL string,
	postgresConnection string,
	storageURL string,
	license string,
) []EnvVar {
	env := []EnvVar{
		{
			Name:       "OPENAI_API_KEY",
			Value:      config.GetAi().GetOpenai().GetApiKey(),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "OPENAI_ORG",
			Value:      unptr(config.GetAi().GetOpenai().GetOrganization()),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "GRAPHITE_WEBHOOK_SECRET",
			Value:      config.GetAi().GetWebhookSecret(),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "GRAPHITE_BASE_URL",
			Value:      "http://ai:8090",
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name: "SYNCH_PERIOD",
			Value: fmt.Sprintf(
				"%dm", unptr(config.GetAi().GetAutoEmbeddings().GetSynchPeriodMinutes()),
			),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_GRAPHQL_URL",
			Value:      nhostGraphqlURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "HASURA_GRAPHQL_ADMIN_SECRET",
			Value:      config.GetHasura().GetAdminSecret(),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "POSTGRES_CONNECTION",
			Value:      postgresConnection,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "NHOST_STORAGE_URL",
			Value:      storageURL,
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "LICENSE",
			Value:      license,
			SecretName: "",
			IsSecret:   false,
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
