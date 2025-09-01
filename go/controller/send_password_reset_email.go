package controller

import (
	"context"
	"errors"
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

	options, err := ctrl.wf.ValidateOptionsRedirectTo(ctx, request.Body.Options, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	request.Body.Options = options

	if !ctrl.wf.ValidateEmail(string(request.Body.Email)) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return api.SendPasswordResetEmail200JSONResponse(api.OK), nil
	}

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	switch {
	case errors.Is(apiErr, ErrInternalServerError):
		return ctrl.respondWithError(apiErr), nil
	case apiErr != nil:
		return api.SendPasswordResetEmail200JSONResponse(api.OK), nil //nolint:nilerr
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
