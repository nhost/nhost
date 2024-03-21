package controller

import (
	"context"
	"errors"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) PostUserEmailChange( //nolint:ireturn
	ctx context.Context, request api.PostUserEmailChangeRequestObject,
) (api.PostUserEmailChangeResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}
	request.Body.Options = options

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	_, apiErr = ctrl.wf.GetUserByEmail(ctx, string(request.Body.NewEmail), logger)
	if apiErr == nil {
		logger.Warn("email already exists")
		return ctrl.sendError(ErrEmailAlreadyInUse), nil
	} else if !errors.Is(apiErr, ErrUserEmailNotFound) {
		logger.Error("error getting user by email", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	updatedUser, apiErr := ctrl.wf.ChangeEmail(ctx, user.ID, string(request.Body.NewEmail), logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if err := ctrl.wf.SendEmail(
		string(request.Body.NewEmail),
		updatedUser.Locale,
		LinkTypeEmailConfirmChange,
		updatedUser.Ticket.String,
		deptr(request.Body.Options.RedirectTo),
		notifications.TemplateNameEmailConfirmChange,
		updatedUser.DisplayName,
		updatedUser.Email.String,
		string(request.Body.NewEmail),
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.PostUserEmailChange200JSONResponse(api.OK), nil
}
