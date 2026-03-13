package graph

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/nhost"
	"github.com/nhost/be/services/mimir/schema"
	"github.com/sirupsen/logrus"
)

// Plugin is executed during mutations after the data has been manipulated but before it's
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
	store   DataStore
	fetcher Fetcher
	schema  *schema.Schema
	plugins []Plugin
	mu      sync.RWMutex
}

func NewResolver(
	store DataStore, fetcher Fetcher, nhostc nhost.Querier, plugins []Plugin,
) (*Resolver, error) {
	s, err := schema.New()
	if err != nil {
		return nil, fmt.Errorf("problem getting schema: %w", err)
	}

	return &Resolver{
		nhost:   nhostc,
		store:   store,
		fetcher: fetcher,
		schema:  s,
		plugins: plugins,
		mu:      sync.RWMutex{},
	}, nil
}

// ensureLoaded checks the cache for appID and fetches from source on miss.
// Must be called BEFORE acquiring any lock.
func (r *Resolver) ensureLoaded(ctx context.Context, appID string) error {
	// Fast path: check cache under RLock
	r.mu.RLock()
	_, err := r.store.GetApp(appID)
	r.mu.RUnlock()

	if err == nil {
		return nil
	}

	if r.fetcher == nil {
		return ErrAppNotFound
	}

	// Fetch from source without holding any lock
	app, fetchErr := r.fetcher.FetchApp(ctx, appID)
	if fetchErr != nil {
		return fmt.Errorf("failed to fetch app %s: %w", appID, fetchErr)
	}

	// Store under write lock with double-check
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, err := r.store.GetApp(appID); err == nil {
		return nil
	}

	r.store.SetApp(appID, app)

	return nil
}

// ensureAllLoaded fetches all app IDs from the source and ensures each is loaded.
func (r *Resolver) ensureAllLoaded(ctx context.Context) error {
	if r.fetcher == nil {
		return nil
	}

	ids, err := r.fetcher.FetchAllAppIDs(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch all app IDs: %w", err)
	}

	for _, id := range ids {
		if err := r.ensureLoaded(ctx, id); err != nil {
			return err
		}
	}

	return nil
}

func (r *Resolver) Data() Data {
	data := make(Data, 0, r.store.Len())
	r.store.Range(func(_ string, app *App) bool {
		data = append(data, app)
		return true
	})

	sort.Slice(data, func(i, j int) bool {
		return data[i].AppID < data[j].AppID
	})

	return data
}

func (r *Resolver) Config() []*model.ConfigAppConfig {
	configs := make([]*model.ConfigAppConfig, 0, r.store.Len())
	r.store.Range(func(_ string, app *App) bool {
		configs = append(configs, &model.ConfigAppConfig{
			AppID:  app.AppID,
			Config: app.Config,
		})

		return true
	})

	sort.Slice(configs, func(i, j int) bool {
		return configs[i].AppID < configs[j].AppID
	})

	return configs
}

func (r *Resolver) AppsSecrets() []model.ConfigAppSecrets {
	values := make([]model.ConfigAppSecrets, 0, r.store.Len())
	r.store.Range(func(_ string, app *App) bool {
		values = append(values, model.ConfigAppSecrets{
			AppID:   app.AppID,
			Secrets: app.Secrets,
		})

		return true
	})

	sort.Slice(values, func(i, j int) bool {
		return values[i].AppID < values[j].AppID
	})

	return values
}
