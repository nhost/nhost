package graph

import (
	"context"
	"fmt"
	"sync"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/nhost"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/sirupsen/logrus"
)

// Plugins are executed during mutations after the data has been manipulated but before it's
// made permanent (i.e. a new object has been created and manipulated but hasn't replaced the old one).
// If a plugin returns an error the mutation is aborted and the error is returned to the client so no
// permanent changes are made.
//
//go:generate mockgen -package graphmock -destination mock/resolver.go . Plugin
type Plugin interface {
	CreateApp(ctx context.Context, app *App, logger logrus.FieldLogger) error
	DeleteApp(ctx context.Context, app *App, logger logrus.FieldLogger) error

	UpdateConfig(ctx context.Context, oldApp, newApp *App, logger logrus.FieldLogger) error
	UpdateSystemConfig(ctx context.Context, oldApp, newApp *App, logger logrus.FieldLogger) error
	UpdateSecrets(ctx context.Context, oldApp, newApp *App, logger logrus.FieldLogger) error

	ChangeDatabaseVersion(ctx context.Context, oldApp, newApp *App, logger logrus.FieldLogger) error

	CreateRunServiceConfig(
		ctx context.Context, appID string, svc *Service, logger logrus.FieldLogger,
	) error
	UpdateRunServiceConfig(
		ctx context.Context,
		appID string,
		oldSvc, newSvc *Service,
		logger logrus.FieldLogger,
	) error
	DeleteRunServiceConfig(
		ctx context.Context, appID string, svc *Service, logger logrus.FieldLogger,
	) error
}

//go:generate mockgen -package graphmock -destination mock/nhost_client.go . NhostClient
type NhostClient nhost.Querier

type Resolver struct {
	nhost   NhostClient
	data    Data
	schema  *schema.Schema
	plugins []Plugin
	mu      sync.RWMutex
}

func NewResolver(data Data, nhostc nhost.Querier, plugins []Plugin) (*Resolver, error) {
	s, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("problem getting schema: %w", err)
	}
	return &Resolver{
		nhost:   nhostc,
		data:    data,
		schema:  s,
		plugins: plugins,
		mu:      sync.RWMutex{},
	}, nil
}

func (r *Resolver) Data() Data {
	return r.data
}

func (r *Resolver) Config() []*model.ConfigAppConfig {
	configs := make([]*model.ConfigAppConfig, len(r.data))
	for i, d := range r.data {
		configs[i] = &model.ConfigAppConfig{
			AppID:  d.AppID,
			Config: d.Config,
		}
	}
	return configs
}

func (r *Resolver) AppsSecrets() []model.ConfigAppSecrets {
	values := make([]model.ConfigAppSecrets, len(r.data))
	for i, d := range r.data {
		values[i] = model.ConfigAppSecrets{
			AppID:   d.AppID,
			Secrets: d.Secrets,
		}
	}
	return values
}
