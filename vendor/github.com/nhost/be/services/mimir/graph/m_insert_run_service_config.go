package graph

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/be/services/mimir/schema"
)

func validateAndFillService(
	sch *schema.Schema,
	svc *Service,
	secrets model.Secrets,
) (*model.ConfigRunServiceConfig, error) {
	if _, err := svc.ResolveConfig(sch, true, secrets); err != nil {
		return nil, err
	}

	config, err := sch.FillRunServiceConfig(svc.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to validate config: %w", err)
	}

	return config, nil
}

func nameMustBeUnique(svcs Services, serviceID, name string) error {
	for _, svc := range svcs {
		if svc.ServiceID == serviceID {
			// we skip the service we are updating
			continue
		}

		if svc.Config.Name == name {
			return ErrNameDuplicated
		}
	}

	return nil
}

func (r *mutationResolver) checkAppLive(ctx context.Context, appID string) error {
	appIDUUID, err := uuid.Parse(appID)
	if err != nil {
		return fmt.Errorf("invalid app ID: %w", err)
	}

	desiredState, err := r.nhost.GetAppDesiredState(ctx, appIDUUID)
	if err != nil {
		return fmt.Errorf("failed to get app desired state: %w", err)
	}

	if desiredState != appLive {
		return ErrAppMustBeLive
	}

	return nil
}

func (r *mutationResolver) insertRunServiceConfig(
	ctx context.Context,
	appID string,
	configInput model.ConfigRunServiceConfigInsertInput,
) (*model.InsertRunServiceConfigResponse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	i, err := r.data.IndexApp(appID)
	if err != nil {
		return nil, err
	}

	app := r.data[i]

	if err := r.checkAppLive(ctx, appID); err != nil {
		return nil, err
	}

	serviceID := uuid.NewString()

	if _, err := app.IndexService(serviceID); err == nil {
		return nil, ErrServiceAlreadyExists
	}

	if err := nameMustBeUnique(app.Services, serviceID, configInput.Name); err != nil {
		return nil, err
	}

	config := &model.ConfigRunServiceConfig{} //nolint:exhaustruct
	config.Insert(&configInput)

	config.Image.Image = strings.ReplaceAll(
		config.Image.Image,
		"<uuid-to-be-generated-on-creation>",
		serviceID,
	)

	svc := &Service{
		ServiceID:      serviceID,
		Config:         config,
		resolvedConfig: nil,
	}

	config, err = validateAndFillService(r.schema, svc, app.Secrets)
	if err != nil {
		return nil, err
	}

	logger := nhcontext.LoggerFromContext(ctx).WithField("service_id", serviceID)
	for _, p := range r.plugins {
		if err := p.CreateRunServiceConfig(ctx, appID, svc, logger); err != nil {
			return nil, fmt.Errorf("plugin %T error: %w", p, err)
		}
	}

	app.Services = append(app.Services, svc)

	return &model.InsertRunServiceConfigResponse{
		ServiceID: serviceID,
		Config:    config,
	}, nil
}
