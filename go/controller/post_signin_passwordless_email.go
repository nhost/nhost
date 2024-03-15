package controller

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) postSigninPasswordlessEmailCreateUser( //nolint:funlen
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (sql.AuthUser, error) {
	if ctrl.config.DisableSignup {
		logger.Warn("signup disabled")
		return sql.AuthUser{}, //nolint:exhaustruct
			&APIError{api.SignupDisabled}
	}

	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.Error("error marshaling metadata", logError(err))
		return sql.AuthUser{}, //nolint:exhaustruct
			&APIError{api.InternalServerError}
	}

	gravatarURL := ctrl.gravatarURL(email)

	insertedUser, err := ctrl.db.InsertUser(
		ctx, sql.InsertUserParams{
			Disabled:        ctrl.config.DisableNewUsers,
			DisplayName:     deptr(options.DisplayName),
			AvatarUrl:       gravatarURL,
			Email:           sql.Text(email),
			PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
			Ticket:          pgtype.Text{}, //nolint:exhaustruct
			TicketExpiresAt: sql.TimestampTz(time.Now()),
			EmailVerified:   false,
			Locale:          deptr(options.Locale),
			DefaultRole:     deptr(options.DefaultRole),
			Metadata:        metadata,
			Roles:           deptr(options.AllowedRoles),
		},
	)
	if err != nil {
		logger.Error("error inserting user", logError(err))
		return sql.AuthUser{}, //nolint:exhaustruct
			&APIError{api.InternalServerError}
	}

	return sql.AuthUser{
		ID:                       insertedUser.UserID,
		CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
		UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
		LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
		Disabled:                 ctrl.config.DisableNewUsers,
		DisplayName:              deptr(options.DisplayName),
		AvatarUrl:                gravatarURL,
		Locale:                   deptr(options.Locale),
		Email:                    sql.Text(email),
		PhoneNumber:              pgtype.Text{}, //nolint:exhaustruct
		PasswordHash:             pgtype.Text{}, //nolint:exhaustruct
		EmailVerified:            false,
		PhoneNumberVerified:      false,
		NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
		OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
		OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
		OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
		DefaultRole:              deptr(options.DefaultRole),
		IsAnonymous:              false,
		TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
		ActiveMfaType:            pgtype.Text{},        //nolint:exhaustruct
		Ticket:                   pgtype.Text{},        //nolint:exhaustruct
		TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
		Metadata:                 metadata,
		WebauthnCurrentChallenge: pgtype.Text{}, //nolint:exhaustruct
	}, nil
}

func (ctrl *Controller) PostSigninPasswordlessEmail( //nolint:ireturn,funlen
	ctx context.Context,
	request api.PostSigninPasswordlessEmailRequestObject,
) (api.PostSigninPasswordlessEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.EmailPasswordlessEnabled {
		logger.Warn("email passwordless signin is disabled")
		return ctrl.sendError(api.DisabledEndpoint), nil
	}

	if !ctrl.validator.emailValidator(string(request.Body.Email)) {
		logger.Warn("email didn't pass access control checks")
		return ctrl.sendError(api.InvalidEmailPassword), nil
	}

	options, err := ctrl.validator.postSignUpOptions(
		request.Body.Options, string(request.Body.Email), logger,
	)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	user, err := ctrl.db.GetUserByEmail(ctx, sql.Text(request.Body.Email))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Info("user does not exist, creating user")

		user, err = ctrl.postSigninPasswordlessEmailCreateUser(
			ctx, string(request.Body.Email), options, logger,
		)
		if err != nil {
			logger.Error("error validating signup request", logError(err))
			return ctrl.respondWithError(err), nil
		}
	}
	if err != nil {
		logger.Error("error getting user by email", logError(err))
		return ctrl.sendError(api.InternalServerError), nil
	}

	if user.Disabled {
		logger.Warn("user is disabled")
		return ctrl.sendError(api.DisabledUser), nil
	}

	ticket, err := ctrl.setTicket(ctx, user.ID, TicketTypePasswordLessEmail, logger)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	if err := ctrl.sendEmail(
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
		return nil, err
	}

	return api.PostSigninPasswordlessEmail200JSONResponse(api.OK), nil
}
