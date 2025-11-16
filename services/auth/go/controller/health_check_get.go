package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) HealthCheckGet( //nolint:ireturn
	_ context.Context, _ api.HealthCheckGetRequestObject,
) (api.HealthCheckGetResponseObject, error) {
	return api.HealthCheckGet200JSONResponse(api.OK), nil
}

func (ctrl *Controller) HealthCheckHead( //nolint:ireturn
	_ context.Context, _ api.HealthCheckHeadRequestObject,
) (api.HealthCheckHeadResponseObject, error) {
	return api.HealthCheckHead200Response{}, nil
}
