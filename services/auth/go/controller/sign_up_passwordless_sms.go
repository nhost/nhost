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
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) SignUpPasswordlessSms( //nolint:ireturn
	ctx context.Context,
	request api.SignUpPasswordlessSmsRequestObject,
) (api.SignUpPasswordlessSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless signup is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

	options, apiErr := ctrl.signinSmsValidateRequest(
		ctx, request.Body.PhoneNumber, request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	// Check if user already exists. To prevent account enumeration we return
	// the same 200 OK (with no SMS sent) whether the user exists or not —
	// mirroring the signin endpoints' behaviour under AUTH_DISABLE_AUTO_SIGNUP.
	_, apiErr = ctrl.wf.GetUserByPhoneNumber(ctx, request.Body.PhoneNumber, logger)
	switch {
	case apiErr == nil:
		logger.InfoContext(ctx, "user already exists, returning OK without sending SMS")
		return api.SignUpPasswordlessSms200JSONResponse(api.OK), nil
	case errors.Is(apiErr, ErrUserPhoneNumberNotFound):
		// User does not exist, proceed with signup
	default:
		logger.ErrorContext(ctx, "error getting user by phone number", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	if apiErr := ctrl.postSigninPasswordlessSmsSignup(
		ctx, request.Body.PhoneNumber, options, logger,
	); apiErr != nil {
		logger.ErrorContext(ctx, "error signing up user", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignUpPasswordlessSms200JSONResponse(api.OK), nil
}

func (ctrl *Controller) postSigninPasswordlessSmsSignup(
	ctx context.Context,
	phoneNumber string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) *APIError {
	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx,
		phoneNumber,
		deptr(options.Locale),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ErrCannotSendSMS
	}

	apiErr := ctrl.wf.SignupUserWithouthSession(
		ctx,
		"", // email is empty for SMS signup
		options,
		false,
		func(
			_ pgtype.Text,
			_ pgtype.Timestamptz,
			metadata []byte,
			gravatarURL string,
		) error {
			_, err := ctrl.wf.db.InsertUser(ctx, sql.InsertUserParams{
				ID:                uuid.New(),
				Disabled:          ctrl.config.DisableNewUsers,
				DisplayName:       deptr(options.DisplayName),
				AvatarUrl:         gravatarURL,
				PhoneNumber:       sql.Text(phoneNumber),
				Otp:               otp,
				OtpHashExpiresAt:  sql.TimestampTz(expiresAt),
				OtpMethodLastUsed: sql.Text("sms"),
				Email:             pgtype.Text{}, //nolint:exhaustruct
				PasswordHash:      pgtype.Text{}, //nolint:exhaustruct
				Ticket:            pgtype.Text{}, //nolint:exhaustruct
				TicketExpiresAt:   sql.TimestampTz(time.Now()),
				EmailVerified:     false,
				Locale:            deptr(options.Locale),
				DefaultRole:       deptr(options.DefaultRole),
				Metadata:          metadata,
				Roles:             deptr(options.AllowedRoles),
			})
			if err != nil {
				return fmt.Errorf("error inserting user: %w", err)
			}

			return nil
		},
		"",
		logger,
	)

	return apiErr
}
