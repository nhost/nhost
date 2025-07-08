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

func (ctrl *Controller) SignInPasswordlessEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignInPasswordlessEmailRequestObject,
) (api.SignInPasswordlessEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.EmailPasswordlessEnabled {
		logger.Warn("email passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		string(request.Body.Email), request.Body.Options, logger)
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
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInPasswordlessEmail200JSONResponse(api.OK), nil
}

func (ctrl *Controller) signinEmailValidateRequest(
	email string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if !ctrl.wf.ValidateEmail(email) {
		logger.Warn("email didn't pass access control checks")
		return nil, ErrInvalidEmailPassword
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(options, email, logger)
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
	logger *slog.Logger,
) *APIError {
	user, apiErr := ctrl.wf.GetUserByEmail(ctx, email, logger)

	switch {
	case errors.Is(apiErr, ErrUserEmailNotFound):
		logger.Info("user does not exist, creating user")

		user, apiErr = ctrl.signinWithTicketSignUp(
			ctx, email, options, ticket, ticketExpiresAt, logger,
		)
		if apiErr != nil {
			return apiErr
		}
	case errors.Is(apiErr, ErrUnverifiedUser):
		if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, ticketExpiresAt, logger); apiErr != nil {
			return apiErr
		}
	case apiErr != nil:
		logger.Error("error getting user by email", logError(apiErr))
		return apiErr
	default:
		if apiErr = ctrl.wf.SetTicket(ctx, user.ID, ticket, ticketExpiresAt, logger); apiErr != nil {
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
		logger,
	); apiErr != nil {
		return apiErr
	}

	return nil
}

func (ctrl *Controller) signinWithTicketSignUp(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	ticket string,
	ticketExpiresAt time.Time,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	var user sql.AuthUser

	apiErr := ctrl.wf.SignupUserWithouthSession(
		ctx,
		email,
		options,
		false,
		func(
			_ pgtype.Text,
			_ pgtype.Timestamptz,
			metadata []byte,
			gravatarURL string,
		) error {
			resp, err := ctrl.wf.db.InsertUser(ctx, sql.InsertUserParams{
				ID:                uuid.New(),
				Disabled:          ctrl.config.DisableNewUsers,
				DisplayName:       deptr(options.DisplayName),
				AvatarUrl:         gravatarURL,
				Email:             sql.Text(email),
				PasswordHash:      pgtype.Text{}, //nolint:exhaustruct
				Ticket:            sql.Text(ticket),
				TicketExpiresAt:   sql.TimestampTz(ticketExpiresAt),
				EmailVerified:     false,
				Locale:            deptr(options.Locale),
				DefaultRole:       deptr(options.DefaultRole),
				Metadata:          metadata,
				Roles:             deptr(options.AllowedRoles),
				PhoneNumber:       pgtype.Text{},        //nolint:exhaustruct
				OtpHash:           pgtype.Text{},        //nolint:exhaustruct
				OtpHashExpiresAt:  pgtype.Timestamptz{}, //nolint:exhaustruct
				OtpMethodLastUsed: pgtype.Text{},        //nolint:exhaustruct
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
