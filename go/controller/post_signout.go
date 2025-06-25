package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostSignout( //nolint:ireturn
	ctx context.Context, request api.PostSignoutRequestObject,
) (api.PostSignoutResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if deptr(request.Body.All) {
		userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
		if apiErr != nil {
			return ctrl.sendError(apiErr), nil
		}

		if apiErr := ctrl.wf.DeleteUserRefreshTokens(ctx, userID, logger); apiErr != nil {
			return ctrl.sendError(apiErr), nil
		}
		return api.PostSignout200JSONResponse(api.OK), nil
	}

	if deptr(request.Body.RefreshToken) == "" {
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	if apiErr := ctrl.wf.DeleteRefreshToken(
		ctx, *request.Body.RefreshToken, logger,
	); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.PostSignout200JSONResponse(api.OK), nil
}
