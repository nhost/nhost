package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
)

func (ctrl *Controller) GetWellKnownJwksJson( //nolint:ireturn,revive,stylecheck
	_ context.Context, _ api.GetWellKnownJwksJsonRequestObject,
) (api.GetWellKnownJwksJsonResponseObject, error) {
	return api.GetWellKnownJwksJson200JSONResponse{
		Keys: ctrl.wf.jwtGetter.jwks,
	}, nil
}
