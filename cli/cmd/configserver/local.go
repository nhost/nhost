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
	"github.com/nhost/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/sirupsen/logrus"
)

const ZeroUUID = "00000000-0000-0000-0000-000000000000"

// placeholderSecretValue is substituted into the in-memory configserver state
// for every secret loaded from .secrets, so real secret material never enters
// the configserver process's heap or its GraphQL responses. The on-disk
// .secrets file remains authoritative; UpdateSecrets re-reads it when
// persisting mutations and only writes through values that differ from this
// placeholder.
//
// The value is intentionally long (>= 64 characters) so that resolved-config
// validation rules with minimum-length constraints (e.g. HS512 JWT keys) still
// pass when an unrelated secret is being updated and the others resolve to
// this placeholder.
const placeholderSecretValue = "<placeholder-from-local-configserver-substituted-for-real-secret>"

var ErrNotImpl = errors.New("this operation is not yet supported")

type Local struct {
	// we use paths instead of readers/writers because the intention is that these
	// files will be mounted as volumes in a container and if the file is changed
	// outside of the container, the filedescriptor might just be pointing to the
	// old file.
	config      string
	secrets     string
	runServices map[string]string
	appID       string
}

func NewLocal(appID, config, secrets string, runServices map[string]string) *Local {
	return &Local{
		config:      config,
		secrets:     secrets,
		runServices: runServices,
		appID:       appID,
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

	secrets, err := loadSecretsRedacted(secretsFile)
	if err != nil {
		return nil, err
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
			AppID:    l.appID,
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

// UpdateSecrets persists the secrets changeset implied by newApp.Secrets,
// merging with the on-disk .secrets file so that placeholder entries (the
// values we loaded into memory in place of real secrets) never overwrite
// actual values stored on disk.
//
// The reconciliation rules are:
//   - A name present in newApp.Secrets whose value equals
//     placeholderSecretValue is treated as "untouched" — the on-disk value is
//     preserved.
//   - A name present in newApp.Secrets whose value differs from the
//     placeholder is treated as a real insert/update — the incoming value is
//     written through.
//   - A name present on disk but absent from newApp.Secrets is deleted.
func (l *Local) UpdateSecrets(_ context.Context, _, newApp *graph.App, _ logrus.FieldLogger) error {
	onDisk, err := readSecretsMap(l.secrets)
	if err != nil {
		return err
	}

	out := make(map[string]string, len(newApp.Secrets))

	for _, v := range newApp.Secrets {
		if v.Value == placeholderSecretValue {
			if existing, ok := onDisk[v.Name]; ok {
				out[v.Name] = existing
			}

			continue
		}

		out[v.Name] = v.Value
	}

	b, err := toml.Marshal(out)
	if err != nil {
		return fmt.Errorf("failed to marshal app secrets: %w", err)
	}

	if err := os.WriteFile(l.secrets, b, 0o644); err != nil { //nolint:gosec,mnd
		return fmt.Errorf("failed to write secrets: %w", err)
	}

	return nil
}

// loadSecretsRedacted reads the on-disk .secrets file and returns a
// model.Secrets whose names match what's on disk but whose values are all
// replaced with placeholderSecretValue. The configserver never holds real
// secret material in memory.
func loadSecretsRedacted(path string) (model.Secrets, error) {
	b, err := os.ReadFile(path)
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

	for _, s := range secrets {
		s.Value = placeholderSecretValue
	}

	return secrets, nil
}

// readSecretsMap reads and parses the local .secrets file into a name->value
// map. Returns an empty map if the file does not exist; this lets
// UpdateSecrets bootstrap from a missing file.
func readSecretsMap(path string) (map[string]string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return map[string]string{}, nil
		}

		return nil, fmt.Errorf("failed to read secrets file: %w", err)
	}

	var secrets model.Secrets
	if err := env.Unmarshal(b, &secrets); err != nil {
		return nil, fmt.Errorf("failed to parse secrets file: %w", err)
	}

	out := make(map[string]string, len(secrets))
	for _, s := range secrets {
		out[s.Name] = s.Value
	}

	return out, nil
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
