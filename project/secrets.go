package project

import (
	"github.com/nhost/be/services/mimir/model"
)

func DefaultSecrets() model.Secrets {
	return model.Secrets{
		{
			Name:  "HASURA_GRAPHQL_ADMIN_SECRET",
			Value: "nhost-admin-secret",
		},
		{
			Name:  "HASURA_GRAPHQL_JWT_SECRET",
			Value: "0f987876650b4a085e64594fae9219e7781b17506bec02489ad061fba8cb22db",
		},
		{
			Name:  "NHOST_WEBHOOK_SECRET",
			Value: "nhost-webhook-secret",
		},
		{
			Name:  "GRAFANA_ADMIN_PASSWORD",
			Value: "grafana-admin-password",
		},
	}
}
