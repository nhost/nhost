package configserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/nhost/be/services/mimir/graph"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/project/env"
	"github.com/pelletier/go-toml/v2"
	"github.com/sirupsen/logrus"
)

const zeroUUID = "00000000-0000-0000-0000-000000000000"

var ErrNotImpl = fmt.Errorf("not implemented")

type Local struct {
	config      io.Writer
	secrets     io.Writer
	runServices map[string]*os.File
}

func NewLocal(config, secrets io.Writer, runServices map[string]*os.File) *Local {
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

func overwriteFile(wr io.Writer, b []byte) error {
	if f, ok := wr.(*os.File); ok {
		if _, err := f.Seek(0, 0); err != nil {
			return fmt.Errorf("failed to seek file: %w", err)
		}

		if err := f.Truncate(0); err != nil {
			return fmt.Errorf("failed to truncate file: %w", err)
		}
	}

	if buf, ok := wr.(*bytes.Buffer); ok {
		buf.Reset()
	}

	if _, err := wr.Write(b); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	if f, ok := wr.(*os.File); ok {
		if err := f.Sync(); err != nil {
			return fmt.Errorf("failed to sync file: %w", err)
		}
	}

	return nil
}

func (l *Local) GetServices(runServices map[string]*os.File) (graph.Services, error) {
	services := make(graph.Services, 0, len(runServices))
	for id, r := range runServices {
		b, err := io.ReadAll(r)
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
	configr, secretsr io.Reader, runServicesr map[string]*os.File,
) ([]*graph.App, error) {
	b, err := io.ReadAll(configr)
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

	b, err = io.ReadAll(secretsr)
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

	services, err := l.GetServices(runServicesr)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}

	return []*graph.App{
		{
			Config:       cfg,
			SystemConfig: nil,
			Secrets:      secrets,
			Services:     services,
			AppID:        zeroUUID,
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

	if err := overwriteFile(l.config, b); err != nil {
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

	if err := overwriteFile(l.secrets, b); err != nil {
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
		return fmt.Errorf("run service not found: %s", newSvc.ServiceID) //nolint:goerr113
	}

	b, err := toml.Marshal(newSvc.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal run service config: %w", err)
	}

	if err := overwriteFile(wr, b); err != nil {
		return fmt.Errorf("failed to write run service config: %w", err)
	}

	return nil
}

func (l *Local) DeleteRunServiceConfig(
	_ context.Context, _ string, _ *graph.Service, _ logrus.FieldLogger,
) error {
	return ErrNotImpl
}
