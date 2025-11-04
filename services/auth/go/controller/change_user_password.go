package controller

import (
	"context"
	"log/slog"

	"github.com/golang-jwt/jwt/v5"
	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) postUserPasswordAuthenticated( //nolint:ireturn
	ctx context.Context,
	request api.ChangeUserPasswordRequestObject,
	jwtToken *jwt.Token,
	logger *slog.Logger,
) (api.ChangeUserPasswordResponseObject, error) {
	logger.DebugContext(ctx, "authenticated request")

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	if _, apiErr := ctrl.wf.GetUser(ctx, userID, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if apiErr := ctrl.wf.ChangePassword(ctx, userID, request.Body.NewPassword, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.ChangeUserPassword200JSONResponse(api.OK), nil
}

func (ctrl *Controller) postUserPasswordUnauthenticated( //nolint:ireturn
	ctx context.Context,
	request api.ChangeUserPasswordRequestObject,
	logger *slog.Logger,
) (api.ChangeUserPasswordResponseObject, error) {
	logger.DebugContext(ctx, "unauthenticated request")

	if request.Body.Ticket == nil {
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	user, apiErr := ctrl.wf.GetUserByTicket(ctx, *request.Body.Ticket, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if apiErr := ctrl.wf.ChangePassword(ctx, user.ID, request.Body.NewPassword, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.ChangeUserPassword200JSONResponse(api.OK), nil
}

func (ctrl *Controller) ChangeUserPassword( //nolint:ireturn
	ctx context.Context,
	request api.ChangeUserPasswordRequestObject,
) (api.ChangeUserPasswordResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if ok {
		return ctrl.postUserPasswordAuthenticated(ctx, request, jwtToken, logger)
	}

	return ctrl.postUserPasswordUnauthenticated(ctx, request, logger)
}
