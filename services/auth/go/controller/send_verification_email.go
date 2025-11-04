package controller

import (
	"context"
	"errors"
	"log/slog"
	"time"

	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
)

func (ctrl *Controller) SendVerificationEmail( //nolint:ireturn
	ctx context.Context,
	request api.SendVerificationEmailRequestObject,
) (api.SendVerificationEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(ctx, request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	request.Body.Options = options

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	switch {
	case errors.Is(apiErr, ErrUnverifiedUser):
	case apiErr == nil && !user.EmailVerified:
	case apiErr != nil:
		return ctrl.respondWithError(apiErr), nil
	default:
		return ctrl.respondWithError(ErrEmailAlreadyVerified), nil
	}

	ticket := generateTicket(TicketTypeVerifyEmail)

	expireAt := time.Now().Add(In30Days)
	if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, expireAt, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		user.Email.String,
		user.Locale,
		LinkTypeEmailVerify,
		ticket,
		deptr(options.RedirectTo),
		notifications.TemplateNameEmailVerify,
		user.DisplayName,
		user.Email.String,
		"",
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.SendVerificationEmail200JSONResponse(api.OK), nil
}
