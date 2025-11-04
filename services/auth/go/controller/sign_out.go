package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) SignOut( //nolint:ireturn
	ctx context.Context, request api.SignOutRequestObject,
) (api.SignOutResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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
