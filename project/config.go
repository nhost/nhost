package project

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
)

func DefaultConfig() (*model.ConfigConfig, error) {
	s, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	c := &model.ConfigConfig{ //nolint:exhaustruct
		Hasura: &model.ConfigHasura{ //nolint:exhaustruct
			AdminSecret:   "{{ secrets.HASURA_GRAPHQL_ADMIN_SECRET }}",
			WebhookSecret: "{{ secrets.NHOST_WEBHOOK_SECRET }}",
			JwtSecrets: []*model.ConfigJWTSecret{
				{
					Type: ptr("HS256"),
					Key:  ptr("{{ secrets.HASURA_GRAPHQL_JWT_SECRET }}"),
				},
			},
		},
		Postgres: &model.ConfigPostgres{ //nolint:exhaustruct
			Resources: &model.ConfigPostgresResources{ //nolint:exhaustruct
				Storage: &model.ConfigPostgresStorage{
					Capacity: 1,
				},
			},
		},
		Observability: &model.ConfigObservability{
			Grafana: &model.ConfigGrafana{
				AdminPassword: "{{ secrets.GRAFANA_ADMIN_PASSWORD }}",
				Smtp:          nil,
				Alerting:      &model.ConfigGrafanaAlerting{}, //nolint:exhaustruct
				Contacts:      &model.ConfigGrafanaContacts{}, //nolint:exhaustruct
			},
		},
	}

	if c, err = s.Fill(c); err != nil {
		return nil, fmt.Errorf("failed to fill config: %w", err)
	}

	if err = s.ValidateConfig(c); err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	return c, nil
}
