package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) appsSecrets(_ context.Context) []*model.ConfigAppSecrets {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*model.ConfigAppSecrets, len(r.data))

	for i, root := range r.data {
		result[i] = &model.ConfigAppSecrets{
			AppID:   root.AppID,
			Secrets: root.Secrets,
		}
	}

	return result
}
