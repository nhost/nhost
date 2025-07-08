package controller

import (
	"context"
	"log/slog"
	"time"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) SendPasswordResetEmail( //nolint:ireturn
	ctx context.Context,
	request api.SendPasswordResetEmailRequestObject,
) (api.SendPasswordResetEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	options, err := ctrl.wf.ValidateOptionsRedirectTo(request.Body.Options, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}
	request.Body.Options = options

	if !ctrl.wf.ValidateEmail(string(request.Body.Email)) {
		logger.Warn("email didn't pass access control checks")
		return ctrl.sendError(ErrInvalidEmailPassword), nil
	}

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	ticket := generateTicket(TicketTypePasswordReset)
	expiresAt := time.Now().Add(time.Hour)
	if apiErr := ctrl.wf.SetTicket(ctx, user.ID, ticket, expiresAt, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		string(request.Body.Email),
		user.Locale,
		LinkTypePasswordReset,
		ticket,
		deptr(request.Body.Options.RedirectTo),
		notifications.TemplateNamePasswordReset,
		user.DisplayName,
		string(request.Body.Email),
		"",
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.SendPasswordResetEmail200JSONResponse(api.OK), nil
}
