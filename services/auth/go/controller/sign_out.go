package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func (ctrl *Controller) SignOut( //nolint:ireturn
	ctx context.Context, request api.SignOutRequestObject,
) (api.SignOutResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if deptr(request.Body.All) {
		userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
		if apiErr != nil {
			return ctrl.sendError(apiErr), nil
		}

		if apiErr := ctrl.wf.DeleteUserRefreshTokens(ctx, userID, logger); apiErr != nil {
			return ctrl.sendError(apiErr), nil
		}

		return api.SignOut200JSONResponse(api.OK), nil
	}

	if deptr(request.Body.RefreshToken) == "" {
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	if apiErr := ctrl.wf.DeleteRefreshToken(
		ctx, *request.Body.RefreshToken, logger,
	); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignOut200JSONResponse(api.OK), nil
}
