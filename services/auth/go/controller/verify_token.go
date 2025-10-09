package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func (ctrl *Controller) VerifyToken( //nolint:ireturn
	ctx context.Context, request api.VerifyTokenRequestObject,
) (api.VerifyTokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if request.Body != nil && request.Body.Token != nil {
		if apiErr := ctrl.wf.VerifyJWTToken(ctx, *request.Body.Token, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}

		return api.VerifyToken200JSONResponse("OK"), nil
	}

	if _, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.VerifyToken200JSONResponse("OK"), nil
}
