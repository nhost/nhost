package controller

import (
	"context"
	"log/slog"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) postUserPasswordAuthenticated( //nolint:ireturn
	ctx context.Context,
	request api.PostUserPasswordRequestObject,
	jwtToken *jwt.Token,
	logger *slog.Logger,
) (api.PostUserPasswordResponseObject, error) {
	logger.Debug("authenticated request")

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	if _, apiErr := ctrl.wf.GetUser(ctx, userID, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if apiErr := ctrl.wf.ChangePassword(ctx, userID, request.Body.NewPassword, logger); apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.PostUserPassword200JSONResponse(api.OK), nil
}

func (ctrl *Controller) postUserPasswordUnauthenticated( //nolint:ireturn
	ctx context.Context,
	request api.PostUserPasswordRequestObject,
	logger *slog.Logger,
) (api.PostUserPasswordResponseObject, error) {
	logger.Debug("unauthenticated request")
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

	return api.PostUserPassword200JSONResponse(api.OK), nil
}

func (ctrl *Controller) PostUserPassword( //nolint:ireturn
	ctx context.Context,
	request api.PostUserPasswordRequestObject,
) (api.PostUserPasswordResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if ok {
		return ctrl.postUserPasswordAuthenticated(ctx, request, jwtToken, logger)
	}

	return ctrl.postUserPasswordUnauthenticated(ctx, request, logger)
}
