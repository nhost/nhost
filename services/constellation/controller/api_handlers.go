package controller

import (
	"context"

	"github.com/nhost/nhost/services/constellation/api"
)

// HealthzGet implements api.StrictServerInterface.
func (c *Controller) HealthzGet( //nolint:ireturn
	_ context.Context, _ api.HealthzGetRequestObject,
) (api.HealthzGetResponseObject, error) {
	return api.HealthzGet200TextResponse("ok"), nil
}

// HealthzHead implements api.StrictServerInterface.
func (c *Controller) HealthzHead( //nolint:ireturn
	_ context.Context, _ api.HealthzHeadRequestObject,
) (api.HealthzHeadResponseObject, error) {
	return api.HealthzHead200Response{}, nil
}

// GetVersion implements api.StrictServerInterface.
func (c *Controller) GetVersion( //nolint:ireturn
	_ context.Context, _ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{Version: c.version}, nil
}
