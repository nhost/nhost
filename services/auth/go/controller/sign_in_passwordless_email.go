package controller

import (
	"context"
	"errors"
	"log/slog"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
)

func (ctrl *Controller) SignInPasswordlessEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignInPasswordlessEmailRequestObject,
) (api.SignInPasswordlessEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.EmailPasswordlessEnabled {
		logger.WarnContext(ctx, "email passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		ctx, string(request.Body.Email), request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	ticket := generateTicket(TicketTypePasswordLessEmail)
	ticketExpiresAt := time.Now().Add(time.Hour)

	if apiErr := ctrl.signinWithTicket(
		ctx,
		string(request.Body.Email),
		options,
		ticket,
		ticketExpiresAt,
		notifications.TemplateNameSigninPasswordless,
		LinkTypePasswordlessEmail,
		deptr(request.Body.CodeChallenge),
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInPasswordlessEmail200JSONResponse(api.OK), nil
}

func (ctrl *Controller) signinEmailValidateRequest(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if !ctrl.wf.ValidateEmail(email) {
		logger.WarnContext(ctx, "email didn't pass access control checks")
		return nil, ErrInvalidEmailPassword
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(ctx, options, email, logger)
	if apiErr != nil {
		return nil, apiErr
	}

	return options, nil
}

func (ctrl *Controller) signinWithTicket(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	ticket string,
	ticketExpiresAt time.Time,
	template notifications.TemplateName,
	linkType LinkType,
	codeChallenge string,
	logger *slog.Logger,
) *APIError {
	user, apiErr := ctrl.wf.GetUserByEmail(ctx, email, logger)

	switch {
	case errors.Is(apiErr, ErrUserEmailNotFound):
		if ctrl.config.DisableAutoSignup {
			// Return nil to prevent account enumeration - caller will return OK
			logger.InfoContext(ctx, "auto-signup disabled, returning OK without sending email")
			return nil
		}

		logger.InfoContext(ctx, "user does not exist, creating user")

		user, apiErr = ctrl.signinWithTicketSignUp(
			ctx, email, options, ticket, ticketExpiresAt, codeChallenge, logger,
		)
		if apiErr != nil {
			return apiErr
		}
	case apiErr != nil && !errors.Is(apiErr, ErrUnverifiedUser):
		logger.ErrorContext(ctx, "error getting user by email", logError(apiErr))
		return apiErr
	default:
		if apiErr = ctrl.wf.SetTicket(
			ctx,
			user.ID,
			ticket,
			ticketExpiresAt,
			logger,
		); apiErr != nil {
			return apiErr
		}
	}

	if apiErr := ctrl.wf.SendEmail(
		ctx,
		email,
		user.Locale,
		linkType,
		ticket,
		deptr(options.RedirectTo),
		template,
		user.DisplayName,
		email,
		"",
		codeChallenge,
		logger,
	); apiErr != nil {
		return apiErr
	}

	return nil
}
