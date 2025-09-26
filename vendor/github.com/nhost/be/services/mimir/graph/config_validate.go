package graph

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/nhost/be/services/mimir/model"
)

const (
	appEmpty  = 0
	appLive   = 5
	appPaused = 6
)

const (
	pitrMinVersion = 20250311
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

	if !oldEncrypted && newEncrypted &&
		!slices.Contains([]int32{appPaused, appEmpty}, desiredState) {
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

	oldConfig, err := oldApp.ResolveConfig(r.schema, false)
	if err != nil {
		return fmt.Errorf("failed to resolve old app config: %w", err)
	}

	newConfig, err := newApp.ResolveConfig(r.schema, false)
	if err != nil {
		return fmt.Errorf("failed to resolve new app config: %w", err)
	}

	oldMajorVersion := deptr(oldConfig.GetPostgres().GetVersion())[:3]
	newMajorVersion := deptr(newConfig.GetPostgres().GetVersion())[:3]

	if oldMajorVersion > newMajorVersion {
		return ErrDatabaseVersionMustBeGreater
	}

	if oldMajorVersion != newMajorVersion &&
		!slices.Contains([]int32{appPaused, appEmpty}, desiredState) {
		return ErrDatabaseVersionMismatch
	}

	return nil
}

func (r *mutationResolver) verifyPostgresVersionForPitr(
	newApp *App,
) error {
	if newApp == nil {
		return nil
	}

	if newApp.Config.GetPostgres().GetPitr() == nil {
		return nil
	}

	p := strings.Split(deptr(newApp.Config.GetPostgres().GetVersion()), "-")
	if len(p) != 3 { //nolint:mnd
		return nil
	}

	// convert string to number
	n, err := strconv.ParseInt(p[1], 10, 64)
	if err != nil {
		return nil //nolint: nilerr
	}

	if n < pitrMinVersion {
		return ErrPitrMinVersion
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
		!slices.Contains([]int32{appPaused, appEmpty}, desiredState) {
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

	if err := r.verifyPostgresVersionForPitr(newApp); err != nil {
		return err
	}

	return nil
}

func verifyStorageIsntDownsized(
	desiredState int32,
	oldStorage []*model.ConfigRunServiceResourcesStorage,
	newStorage []*model.ConfigRunServiceResourcesStorage,
) error {
	if slices.Contains([]int32{appPaused, appEmpty}, desiredState) {
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
