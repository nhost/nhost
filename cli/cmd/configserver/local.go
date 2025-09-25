package configserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/nhost/be/services/mimir/graph"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/sirupsen/logrus"
)

const zeroUUID = "00000000-0000-0000-0000-000000000000"

var ErrNotImpl = errors.New("not implemented")

type Local struct {
	// we use paths instead of readers/writers because the intention is that these
	// files will be mounted as volumes in a container and if the file is changed
	// outside of the container, the filedescriptor might just be pointing to the
	// old file.
	config      string
	secrets     string
	runServices map[string]string
}

func NewLocal(config, secrets string, runServices map[string]string) *Local {
	return &Local{
		config:      config,
		secrets:     secrets,
		runServices: runServices,
	}
}

func unmarshal[T any](config any) (*T, error) {
	b, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling cue value: %w", err)
	}

	var cfg T
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, fmt.Errorf("problem unmarshaling cue value: %w", err)
	}

	return &cfg, nil
}

func (l *Local) GetServices(runServices map[string]string) (graph.Services, error) {
	services := make(graph.Services, 0, len(runServices))
	for id, r := range runServices {
		b, err := os.ReadFile(r)
		if err != nil {
			return nil, fmt.Errorf("failed to read run service file: %w", err)
		}

		var cfg model.ConfigRunServiceConfig
		if err := toml.Unmarshal(b, &cfg); err != nil {
			return nil, fmt.Errorf("failed to unmarshal run service config: %w", err)
		}

		services = append(services, &graph.Service{
			ServiceID: id,
			Config:    &cfg,
		})
	}

	return services, nil
}

func (l *Local) GetApps(
	configFile, secretsFile string, runServicesFiles map[string]string,
) ([]*graph.App, error) {
	b, err := os.ReadFile(configFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var rawCfg any
	if err := toml.Unmarshal(b, &rawCfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	cfg, err := unmarshal[model.ConfigConfig](rawCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to fill config: %w", err)
	}

	b, err = os.ReadFile(secretsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read secrets file: %w", err)
	}

	var secrets model.Secrets
	if err := env.Unmarshal(b, &secrets); err != nil {
		return nil, fmt.Errorf(
			"failed to parse secrets, make sure secret values are between quotes: %w",
			err,
		)
	}

	services, err := l.GetServices(runServicesFiles)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}

	pgMajorVersion := "14"
	if cfg.GetPostgres().GetVersion() != nil {
		pgMajorVersion = strings.Split(*cfg.GetPostgres().GetVersion(), ".")[0]
	}

	return []*graph.App{
		{
			Config: cfg,
			SystemConfig: &model.ConfigSystemConfig{ //nolint:exhaustruct
				Postgres: &model.ConfigSystemConfigPostgres{ //nolint:exhaustruct
					MajorVersion: &pgMajorVersion,
					Database:     "local",
					ConnectionString: &model.ConfigSystemConfigPostgresConnectionString{
						Backup:  "a",
						Hasura:  "a",
						Auth:    "a",
						Storage: "a",
					},
				},
			},
			Secrets:  secrets,
			Services: services,
			AppID:    zeroUUID,
		},
	}, nil
}

func (l *Local) CreateApp(_ context.Context, _ *graph.App, _ logrus.FieldLogger) error {
	return ErrNotImpl
}

func (l *Local) DeleteApp(_ context.Context, _ *graph.App, _ logrus.FieldLogger) error {
	return ErrNotImpl
}

func (l *Local) UpdateConfig(_ context.Context, _, newApp *graph.App, _ logrus.FieldLogger) error {
	b, err := toml.Marshal(newApp.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal app config: %w", err)
	}

	if err := os.WriteFile(l.config, b, 0o644); err != nil { //nolint:gosec,mnd
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

func (l *Local) UpdateSystemConfig(_ context.Context, _, _ *graph.App, _ logrus.FieldLogger) error {
	return ErrNotImpl
}

func (l *Local) UpdateSecrets(_ context.Context, _, newApp *graph.App, _ logrus.FieldLogger) error {
	m := make(map[string]string)
	for _, v := range newApp.Secrets {
		m[v.Name] = v.Value
	}

	b, err := toml.Marshal(m)
	if err != nil {
		return fmt.Errorf("failed to marshal app secrets: %w", err)
	}

	if err := os.WriteFile(l.secrets, b, 0o644); err != nil { //nolint:gosec,mnd
		return fmt.Errorf("failed to write secrets: %w", err)
	}

	return nil
}

func (l *Local) CreateRunServiceConfig(
	_ context.Context, _ string, _ *graph.Service, _ logrus.FieldLogger,
) error {
	return ErrNotImpl
}

func (l *Local) UpdateRunServiceConfig(
	_ context.Context, _ string, _, newSvc *graph.Service, _ logrus.FieldLogger,
) error {
	wr, ok := l.runServices[newSvc.ServiceID]
	if !ok {
		return fmt.Errorf("run service not found: %s", newSvc.ServiceID) //nolint:err113
	}

	b, err := toml.Marshal(newSvc.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal run service config: %w", err)
	}

	if err := os.WriteFile(wr, b, 0o644); err != nil { //nolint:gosec,mnd
		return fmt.Errorf("failed to write run service config: %w", err)
	}

	return nil
}

func (l *Local) DeleteRunServiceConfig(
	_ context.Context, _ string, _ *graph.Service, _ logrus.FieldLogger,
) error {
	return ErrNotImpl
}

func (l *Local) ChangeDatabaseVersion(
	_ context.Context,
	_, _ *graph.App,
	_ logrus.FieldLogger,
) error {
	return ErrNotImpl
}
