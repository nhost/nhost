package graph

import (
	"fmt"

	"github.com/nhost/be/services/mimir/model"
)

func (r *mutationResolver) configValidate(
	oldApp *App,
	newApp *App,
) error {
	if oldApp.Config.GetPostgres().GetResources().GetStorage().GetCapacity() >
		newApp.Config.GetPostgres().GetResources().GetStorage().GetCapacity() {
		return fmt.Errorf("postgres: %w", ErrStorageCantBeDownsized)
	}

	return nil
}

func verifyStorageIsntDownsized(
	oldStorage []*model.ConfigRunServiceResourcesStorage,
	newStorage []*model.ConfigRunServiceResourcesStorage,
) error {
	for _, o := range oldStorage {
		for _, n := range newStorage {
			if n.Name == o.Name && n.Capacity < o.Capacity {
				return fmt.Errorf("%s: %w", o.Name, ErrStorageCantBeDownsized)
			}
		}
	}

	return nil
}

func (r *mutationResolver) runServiceConfigValidate(
	oldService *Service,
	newService *Service,
) error {
	return verifyStorageIsntDownsized(
		oldService.Config.GetResources().GetStorage(),
		newService.Config.GetResources().GetStorage(),
	)
}
