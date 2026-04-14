package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) appsSecrets(ctx context.Context) ([]*model.ConfigAppSecrets, error) {
	if err := r.ensureAllLoaded(ctx); err != nil {
		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*model.ConfigAppSecrets, 0, r.store.Len())

	r.store.Range(func(_ string, app *App) bool {
		result = append(result, &model.ConfigAppSecrets{
			AppID:   app.AppID,
			Secrets: app.Secrets,
		})

		return true
	})

	return result, nil
}
