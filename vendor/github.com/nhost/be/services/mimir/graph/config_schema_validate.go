package graph

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

// validateConfig always validates the complete resolved mutation candidate,
// regardless of whether it has previously been resolved or cached for reading.
func (a *App) validateConfig(sch *schema.Schema) error {
	cfg, err := appconfig.SecretsResolver(a.Config, a.Secrets, sch.Fill)
	if err != nil {
		return fmt.Errorf("failed to resolve config: %w", err)
	}

	a.resolvedConfig = cfg

	return nil
}

func (s *Service) validateConfig(sch *schema.Schema, secrets model.Secrets) error {
	cfg, err := appconfig.SecretsResolver(s.Config, secrets, sch.FillRunServiceConfig)
	if err != nil {
		return fmt.Errorf("failed to resolve config: %w", err)
	}

	s.resolvedConfig = cfg

	return nil
}

func (a *App) validateSystemConfig(sch *schema.Schema) error {
	if _, err := sch.FillSystemConfig(a.SystemConfig); err != nil {
		return fmt.Errorf("failed to fill system config: %w", err)
	}

	return nil
}

func (a *App) validateSecrets(sch *schema.Schema) error {
	if err := a.validateConfig(sch); err != nil {
		return err
	}

	for _, service := range a.Services {
		if err := service.validateConfig(sch, a.Secrets); err != nil {
			return fmt.Errorf("failed to validate service %s: %w", service.ServiceID, err)
		}
	}

	return nil
}
