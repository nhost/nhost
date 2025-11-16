package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) GetVersion( //nolint:ireturn
	_ context.Context, _ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{
		Version: ctrl.version,
	}, nil
}
