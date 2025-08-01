package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) ChangeUserEmail( //nolint:ireturn
	ctx context.Context, request api.ChangeUserEmailRequestObject,
) (api.ChangeUserEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(ctx, request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	request.Body.Options = options

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	exists, apiErr := ctrl.wf.UserByEmailExists(ctx, string(request.Body.NewEmail), logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if exists {
		logger.WarnContext(ctx, "email already exists")
		return ctrl.sendError(ErrEmailAlreadyInUse), nil
	}

	updatedUser, apiErr := ctrl.wf.ChangeEmail(ctx, user.ID, string(request.Body.NewEmail), logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
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

	return api.ChangeUserEmail200JSONResponse(api.OK), nil
}
