package graph

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/nhost/be/services/mimir/schema/appconfig"
)

type Data []*App

func (d Data) IndexApp(id string) (int, error) {
	for i, app := range d {
		if app == nil {
			continue
		}
		if app.AppID == id {
			return i, nil
		}
	}
	return 0, ErrAppNotFound
}

type Services []*Service

func (s Services) Clone() Services {
	newServices := make(Services, len(s))
	for i, v := range s {
		newServices[i] = &Service{
			ServiceID:      v.ServiceID,
			Config:         v.Config.Clone(),
			resolvedConfig: v.resolvedConfig.Clone(),
		}
	}
	return newServices
}

type Service struct {
	ServiceID string
	Config    *model.ConfigRunServiceConfig
	// this is a cached version of the config with everything resolvedConfig
	resolvedConfig *model.ConfigRunServiceConfig `json:"-"`
}

func (s *Service) ResolveConfig(
	sch *schema.Schema, refresh bool, secrets model.Secrets,
) (*model.ConfigRunServiceConfig, error) {
	if s.resolvedConfig != nil && !refresh {
		return s.resolvedConfig, nil
	}

	cfg, err := appconfig.SecretsResolver(s.Config, secrets, sch.FillRunServiceConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve config: %w", err)
	}

	s.resolvedConfig = cfg

	return cfg, nil
}

type App struct {
	Config *model.ConfigConfig
	// this is a cached version of the config with everything resolved
	resolvedConfig *model.ConfigConfig `json:"-"`
	SystemConfig   *model.ConfigSystemConfig
	Secrets        model.Secrets
	Services       Services
	AppID          string
}

func (a *App) IndexSecret(name string) (int, error) {
	for i, v := range a.Secrets {
		if v.Name == name {
			return i, nil
		}
	}
	return 0, ErrSecretNotFound
}

func (a *App) IndexService(id string) (int, error) {
	for i, v := range a.Services {
		if v.ServiceID == id {
			return i, nil
		}
	}
	return 0, ErrServiceNotFound
}

// This method is used to resolve the config with all the templates.
// As this is a somewhat expensive operation, we cache the result if
// the cached object is nil or if refresh is set to true.
func (a *App) ResolveConfig(sch *schema.Schema, refresh bool) (*model.ConfigConfig, error) {
	if a.resolvedConfig != nil && !refresh {
		return a.resolvedConfig, nil
	}

	cfg, err := appconfig.SecretsResolver(a.Config, a.Secrets, sch.Fill)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve config: %w", err)
	}

	a.resolvedConfig = cfg

	return cfg, nil
}

func (a *App) ResolveSystemConfig(sch *schema.Schema) (*model.ConfigSystemConfig, error) {
	cfg, err := sch.FillSystemConfig(a.SystemConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to fill system config: %w", err)
	}
	return cfg, nil
}
