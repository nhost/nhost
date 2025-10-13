package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) GetJWKs( //nolint:ireturn
	_ context.Context, _ api.GetJWKsRequestObject,
) (api.GetJWKsResponseObject, error) {
	return api.GetJWKs200JSONResponse{
		Keys: ctrl.wf.jwtGetter.jwks,
	}, nil
}
