package controller

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) postSignupEmailPasswordValidateRequest(
	ctx context.Context, req api.SignUpEmailPasswordRequestObject, logger *slog.Logger,
) (api.SignUpEmailPasswordRequestObject, *APIError) {
	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup disabled")
		return api.SignUpEmailPasswordRequestObject{}, ErrSignupDisabled
	}

	if err := ctrl.wf.ValidateSignupEmail(ctx, req.Body.Email, logger); err != nil {
		return api.SignUpEmailPasswordRequestObject{}, err
	}

	if err := ctrl.wf.ValidatePassword(ctx, req.Body.Password, logger); err != nil {
		return api.SignUpEmailPasswordRequestObject{}, err
	}

	options, err := ctrl.wf.ValidateSignUpOptions(
		ctx, req.Body.Options, string(req.Body.Email), logger,
	)
	if err != nil {
		return api.SignUpEmailPasswordRequestObject{}, err
	}

	req.Body.Options = options

	return req, nil
}

func (ctrl *Controller) SignUpEmailPassword( //nolint:ireturn
	ctx context.Context,
	req api.SignUpEmailPasswordRequestObject,
) (api.SignUpEmailPasswordResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).With(slog.String("email", string(req.Body.Email)))

	req, apiError := ctrl.postSignupEmailPasswordValidateRequest(ctx, req, logger)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	hashedPassword, err := hashPassword(req.Body.Password)
	if err != nil {
		logger.ErrorContext(ctx, "error hashing password", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	session, apiErr := ctrl.wf.SignupUserWithFn(
		ctx,
		string(req.Body.Email),
		req.Body.Options,
		true,
		ctrl.postSignupEmailPasswordWithSession(
			ctx, string(req.Body.Email), hashedPassword, req.Body.Options,
		),
		ctrl.postSignupEmailPasswordWithoutSession(
			ctx, string(req.Body.Email), hashedPassword, req.Body.Options,
		),
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignUpEmailPassword200JSONResponse{Session: session}, nil
}

func (ctrl *Controller) postSignupEmailPasswordWithSession(
	ctx context.Context,
	email string,
	hashedPassword string,
	options *api.SignUpOptions,
) databaseWithSessionFn {
	return func(
		refreshTokenHash pgtype.Text,
		refreshTokenExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) (uuid.UUID, uuid.UUID, error) {
		resp, err := ctrl.wf.db.InsertUserWithRefreshToken(
			ctx, sql.InsertUserWithRefreshTokenParams{
				Disabled:              ctrl.config.DisableNewUsers,
				DisplayName:           deptr(options.DisplayName),
				AvatarUrl:             gravatarURL,
				Email:                 sql.Text(email),
				PasswordHash:          sql.Text(hashedPassword),
				Ticket:                pgtype.Text{}, //nolint:exhaustruct
				TicketExpiresAt:       sql.TimestampTz(time.Now()),
				EmailVerified:         false,
				Locale:                deptr(options.Locale),
				DefaultRole:           deptr(options.DefaultRole),
				Metadata:              metadata,
				Roles:                 deptr(options.AllowedRoles),
				IsAnonymous:           false,
				RefreshTokenHash:      refreshTokenHash,
				RefreshTokenExpiresAt: refreshTokenExpiresAt,
			},
		)
		if err != nil {
			return uuid.Nil, uuid.Nil,
				fmt.Errorf("error inserting user with refresh token: %w", err)
		}

		return resp.ID, resp.RefreshTokenID, nil
	}
}

func (ctrl *Controller) postSignupEmailPasswordWithoutSession(
	ctx context.Context,
	email string,
	hashedPassword string,
	options *api.SignUpOptions,
) databaseWithoutSessionFn {
	return func(
		ticket pgtype.Text,
		ticketExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) error {
		_, err := ctrl.wf.db.InsertUser(ctx, sql.InsertUserParams{
			ID:                uuid.New(),
			Disabled:          ctrl.config.DisableNewUsers,
			DisplayName:       deptr(options.DisplayName),
			AvatarUrl:         gravatarURL,
			Email:             sql.Text(email),
			PasswordHash:      sql.Text(hashedPassword),
			Ticket:            ticket,
			TicketExpiresAt:   ticketExpiresAt,
			EmailVerified:     false,
			Locale:            deptr(options.Locale),
			DefaultRole:       deptr(options.DefaultRole),
			Metadata:          metadata,
			Roles:             deptr(options.AllowedRoles),
			PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
			Otp:               "",
			OtpHashExpiresAt:  pgtype.Timestamptz{}, //nolint:exhaustruct
			OtpMethodLastUsed: pgtype.Text{},        //nolint:exhaustruct
		})
		if err != nil {
			return fmt.Errorf("error inserting user: %w", err)
		}

		return nil
	}
}
