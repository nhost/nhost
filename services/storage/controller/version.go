package controller

import (
	"context"

	"github.com/nhost/nhost/services/storage/api"
)

func (ctrl *Controller) GetVersion( //nolint:ireturn
	_ context.Context,
	_ api.GetVersionRequestObject,
) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{
		BuildVersion: ctrl.version,
	}, nil
}
