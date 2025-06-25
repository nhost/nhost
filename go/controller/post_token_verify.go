package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostTokenVerify( //nolint:ireturn
	ctx context.Context, request api.PostTokenVerifyRequestObject,
) (api.PostTokenVerifyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if request.Body != nil && request.Body.Token != nil {
		if apiErr := ctrl.wf.VerifyJWTToken(ctx, *request.Body.Token, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}

		return api.PostTokenVerify200JSONResponse("OK"), nil
	}

	if _, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}
	return api.PostTokenVerify200JSONResponse("OK"), nil
}
