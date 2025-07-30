package graph

import (
	"context"

	"github.com/nhost/be/services/mimir/model"
)

func (r *queryResolver) appSecrets(
	_ context.Context,
	appID string,
) ([]*model.ConfigEnvironmentVariable, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, root := range r.data {
		if root.AppID == appID {
			return root.Secrets, nil
		}
	}

	return nil, nil
}
