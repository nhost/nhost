package controller

import (
	"context"
	"errors"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
)

func (validator *Validator) optionsRedirectTo(
	options *api.OptionsRedirectTo,
	logger *slog.Logger,
) error {
	if options.RedirectTo == nil {
		options.RedirectTo = ptr(validator.cfg.ClientURL.String())
	} else if !validator.redirectURLValidator(deptr(options.RedirectTo)) {
		logger.Warn("redirect URL not allowed", slog.String("redirectTo", deptr(options.RedirectTo)))
		return &APIError{api.RedirecToNotAllowed}
	}

	return nil
}

func (validator *Validator) PostUserPasswordReset(
	ctx context.Context,
	request *api.PostUserPasswordResetRequestObject,
	logger *slog.Logger,
) (sql.AuthUser, error) {
	if request.Body.Options == nil {
		request.Body.Options = &api.OptionsRedirectTo{} //nolint:exhaustruct
	}

	if err := validator.optionsRedirectTo(request.Body.Options, logger); err != nil {
		return sql.AuthUser{}, err
	}

	if !validator.emailValidator(string(request.Body.Email)) {
		logger.Warn("email didn't pass access control checks")
		return sql.AuthUser{}, &APIError{api.InvalidEmailPassword} //nolint:exhaustruct
	}

	user, err := validator.db.GetUserByEmail(ctx, sql.Text(request.Body.Email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Warn("user not found")
		return sql.AuthUser{}, &APIError{api.UserNotFound} //nolint:exhaustruct
	}
	if err != nil {
		logger.Error("failed to get user", logError(err))
		return sql.AuthUser{}, &APIError{api.InternalServerError} //nolint:exhaustruct
	}

	if user.Disabled {
		logger.Warn("user is disabled")
		return sql.AuthUser{}, &APIError{api.DisabledUser} //nolint:exhaustruct
	}

	if !user.EmailVerified && validator.cfg.RequireEmailVerification {
		logger.Warn("user email not verified")
		return sql.AuthUser{}, &APIError{api.UnverifiedUser} //nolint:exhaustruct
	}

	return user, nil
}

func (ctrl *Controller) PostUserPasswordReset( //nolint:ireturn
	ctx context.Context,
	request api.PostUserPasswordResetRequestObject,
) (api.PostUserPasswordResetResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	user, err := ctrl.validator.PostUserPasswordReset(ctx, &request, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	ticket, err := ctrl.setTicket(ctx, user.ID, TicketTypePasswordReset, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	if err := ctrl.sendEmail(
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
		return nil, err
	}

	return api.PostUserPasswordReset200JSONResponse(api.OK), nil
}
