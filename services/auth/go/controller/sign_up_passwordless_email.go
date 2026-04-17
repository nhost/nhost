package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) SignUpPasswordlessEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignUpPasswordlessEmailRequestObject,
) (api.SignUpPasswordlessEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.EmailPasswordlessEnabled {
		logger.WarnContext(ctx, "email passwordless signup is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		ctx, string(request.Body.Email), request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	// Check if user already exists. To prevent account enumeration we return
	// the same 200 OK (with no email sent) whether the user exists or not —
	// mirroring the signin endpoints' behaviour under AUTH_DISABLE_AUTO_SIGNUP.
	_, apiErr = ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	switch {
	case apiErr == nil, errors.Is(apiErr, ErrUnverifiedUser):
		logger.InfoContext(ctx, "user already exists, returning OK without sending email")
		return api.SignUpPasswordlessEmail200JSONResponse(api.OK), nil
	case errors.Is(apiErr, ErrUserEmailNotFound):
		// User does not exist, proceed with signup
	default:
		logger.ErrorContext(ctx, "error getting user by email", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	ticket := generateTicket(TicketTypePasswordLessEmail)
	ticketExpiresAt := time.Now().Add(time.Hour)

	// Call signupWithTicket directly since we've already verified user doesn't exist
	if apiErr := ctrl.signupWithTicket(
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

	return api.SignUpPasswordlessEmail200JSONResponse(api.OK), nil
}

// signupWithTicket is used by explicit signup endpoints to create a new user directly.
// It assumes the caller has already verified the user does not exist.
func (ctrl *Controller) signupWithTicket(
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
	user, apiErr := ctrl.signinWithTicketSignUp(
		ctx, email, options, ticket, ticketExpiresAt, codeChallenge, logger,
	)
	if apiErr != nil {
		return apiErr
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

func (ctrl *Controller) signinWithTicketSignUp(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	ticket string,
	ticketExpiresAt time.Time,
	codeChallenge string,
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
				PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
				Otp:               "",
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
		codeChallenge,
		logger,
	)

	return user, apiErr
}
