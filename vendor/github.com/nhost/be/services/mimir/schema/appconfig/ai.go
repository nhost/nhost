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
	ai := config.GetAi()

	env := []EnvVar{
		{
			Name:       "OPENAI_API_KEY",
			Value:      ai.GetOpenai().GetApiKey(),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "OPENAI_ORG",
			Value:      unptr(ai.GetOpenai().GetOrganization()),
			IsSecret:   false,
			SecretName: "",
		},
		{
			Name:       "GRAPHITE_WEBHOOK_SECRET",
			Value:      ai.GetWebhookSecret(),
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
				"%dm", unptr(ai.GetAutoEmbeddings().GetSynchPeriodMinutes()),
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

	if anthropic := ai.GetAnthropic(); anthropic != nil {
		env = append(env, EnvVar{
			Name:       "ANTHROPIC_API_KEY",
			Value:      anthropic.GetApiKey(),
			IsSecret:   false,
			SecretName: "",
		})
	}

	if google := ai.GetGoogle(); google != nil {
		env = append(env, EnvVar{
			Name:       "GOOGLE_AI_API_KEY",
			Value:      google.GetApiKey(),
			IsSecret:   false,
			SecretName: "",
		})
	}

	if webSearch := ai.GetWebSearch(); webSearch != nil {
		if key := unptr(webSearch.GetBraveApiKey()); key != "" {
			env = append(env, EnvVar{
				Name:       "BRAVE_API_KEY",
				Value:      key,
				IsSecret:   false,
				SecretName: "",
			})
		}

		if key := unptr(webSearch.GetTavilyApiKey()); key != "" {
			env = append(env, EnvVar{
				Name:       "TAVILY_API_KEY",
				Value:      key,
				IsSecret:   false,
				SecretName: "",
			})
		}
	}

	for _, e := range config.GetGlobal().GetEnvironment() {
		env = append(env, EnvVar{ //nolint:exhaustruct
			Name:  e.Name,
			Value: e.Value,
		})
	}

	return env
}
