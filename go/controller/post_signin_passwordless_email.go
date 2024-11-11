package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) postSigninPasswordlessEmailValidateRequest(
	request api.PostSigninPasswordlessEmailRequestObject,
	logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if !ctrl.config.EmailPasswordlessEnabled {
		logger.Warn("email passwordless signin is disabled")
		return nil, ErrDisabledEndpoint
	}

	if !ctrl.wf.ValidateEmail(string(request.Body.Email)) {
		logger.Warn("email didn't pass access control checks")
		return nil, ErrInvalidEmailPassword
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(
		request.Body.Options, string(request.Body.Email), logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	return options, nil
}

func (ctrl *Controller) PostSigninPasswordlessEmail( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninPasswordlessEmailRequestObject,
) (api.PostSigninPasswordlessEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	options, apiErr := ctrl.postSigninPasswordlessEmailValidateRequest(request, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	ticket := generateTicket(TicketTypePasswordLessEmail)
	ticketExpiresAt := time.Now().Add(time.Hour)

	switch {
	case errors.Is(apiErr, ErrUserEmailNotFound):
		logger.Info("user does not exist, creating user")

		user, apiErr = ctrl.postSigninPasswordlessEmailSignUp(
			ctx, request, options, ticket, ticketExpiresAt, logger,
		)
		if apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}
	case errors.Is(apiErr, ErrUnverifiedUser):
		if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, ticketExpiresAt, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}
	case apiErr != nil:
		logger.Error("error getting user by email", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	default:
		if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, ticketExpiresAt, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		string(request.Body.Email),
		user.Locale,
		LinkTypePasswordlessEmail,
		ticket,
		deptr(options.RedirectTo),
		notifications.TemplateNameSigninPasswordless,
		user.DisplayName,
		string(request.Body.Email),
		"",
		logger,
	); err != nil {
		return ctrl.sendError(err), nil
	}

	return api.PostSigninPasswordlessEmail200JSONResponse(api.OK), nil
}

func (ctrl *Controller) postSigninPasswordlessEmailSignUp(
	ctx context.Context,
	request api.PostSigninPasswordlessEmailRequestObject,
	options *api.SignUpOptions,
	ticket string,
	ticketExpiresAt time.Time,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	var user sql.AuthUser

	apiErr := ctrl.wf.SignupUserWithouthSession(
		ctx,
		string(request.Body.Email),
		options,
		false,
		func(
			_ pgtype.Text,
			_ pgtype.Timestamptz,
			metadata []byte,
			gravatarURL string,
		) error {
			resp, err := ctrl.wf.db.InsertUser(ctx, sql.InsertUserParams{
				ID:              uuid.New(),
				Disabled:        ctrl.config.DisableNewUsers,
				DisplayName:     deptr(options.DisplayName),
				AvatarUrl:       gravatarURL,
				Email:           sql.Text(request.Body.Email),
				PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
				Ticket:          sql.Text(ticket),
				TicketExpiresAt: sql.TimestampTz(ticketExpiresAt),
				EmailVerified:   false,
				Locale:          deptr(options.Locale),
				DefaultRole:     deptr(options.DefaultRole),
				Metadata:        metadata,
				Roles:           deptr(options.AllowedRoles),
			})
			if err != nil {
				return fmt.Errorf("error inserting user: %w", err)
			}

			user = sql.AuthUser{ //nolint:exhaustruct
				ID:          resp.UserID,
				Locale:      deptr(options.Locale),
				DisplayName: deptr(options.DisplayName),
			}

			return nil
		},
		logger,
	)

	return user, apiErr
}
