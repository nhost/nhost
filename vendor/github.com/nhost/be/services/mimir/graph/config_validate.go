package graph

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/nhost/be/services/mimir/model"
)

const (
	appLive   = 5
	appPaused = 6
)

func (r *mutationResolver) configValidateVerifyPersistentVolumeEncryption(
	desiredState int32,
	oldApp *App,
	newApp *App,
) error {
	if oldApp == nil {
		return nil
	}

	oldEncrypted := deptr(oldApp.SystemConfig.GetPersistentVolumesEncrypted())
	newEncrypted := deptr(newApp.SystemConfig.GetPersistentVolumesEncrypted())

	if oldEncrypted && !newEncrypted {
		return ErrPersVolEncryptionCantBeDis
	}

	if !oldEncrypted && newEncrypted && desiredState != appPaused {
		return ErrPersVolEncryptionCantBeChanged
	}

	return nil
}

func (r *mutationResolver) configValidateVerifyPostgresVersionChange(
	desiredState int32,
	oldApp *App,
	newApp *App,
) error {
	if oldApp == nil {
		return nil
	}

	oldMajorVersion := deptr(oldApp.Config.GetPostgres().GetVersion())[:3]
	newMajorVersion := deptr(newApp.Config.GetPostgres().GetVersion())[:3]

	if oldMajorVersion > newMajorVersion {
		return ErrDatabaseVersionMustBeGreater
	}

	if oldMajorVersion != newMajorVersion && desiredState != appPaused {
		return ErrDatabaseVersionMismatch
	}

	return nil
}

func (r *mutationResolver) configValidate(
	ctx context.Context,
	oldApp *App,
	newApp *App,
) error {
	id, err := uuid.Parse(newApp.AppID)
	if err != nil {
		return fmt.Errorf("failed to parse app id: %w", err)
	}

	desiredState, err := r.nhost.GetAppDesiredState(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get app desired state: %w", err)
	}

	if oldApp != nil && oldApp.Config.GetPostgres().GetResources().GetStorage().GetCapacity() >
		newApp.Config.GetPostgres().GetResources().GetStorage().GetCapacity() &&
		desiredState != appPaused {
		return fmt.Errorf("postgres: %w", ErrStorageCantBeDownsized)
	}

	if err := r.configValidateVerifyPostgresVersionChange(
		desiredState, oldApp, newApp,
	); err != nil {
		return err
	}

	if err := r.configValidateVerifyPersistentVolumeEncryption(
		desiredState, oldApp, newApp,
	); err != nil {
		return err
	}

	return nil
}

func verifyStorageIsntDownsized(
	desiredState int32,
	oldStorage []*model.ConfigRunServiceResourcesStorage,
	newStorage []*model.ConfigRunServiceResourcesStorage,
) error {
	if desiredState == appPaused {
		return nil
	}

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
	ctx context.Context,
	appID string,
	oldService *Service,
	newService *Service,
) error {
	id, err := uuid.Parse(appID)
	if err != nil {
		return fmt.Errorf("failed to parse app id: %w", err)
	}

	desiredState, err := r.nhost.GetAppDesiredState(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to get app desired state: %w", err)
	}

	return verifyStorageIsntDownsized(
		desiredState,
		oldService.Config.GetResources().GetStorage(),
		newService.Config.GetResources().GetStorage(),
	)
}
