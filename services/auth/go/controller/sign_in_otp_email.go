package controller

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000)) //nolint:mnd
	if err != nil {
		return "", fmt.Errorf("error generating OTP: %w", err)
	}

	return fmt.Sprintf("%06d", n), nil
}

func (ctrl *Controller) SignInOTPEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignInOTPEmailRequestObject,
) (api.SignInOTPEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.OTPEmailEnabled {
		logger.WarnContext(ctx, "otp email signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		ctx, string(request.Body.Email), request.Body.Options, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	otp, err := generateOTP()
	if err != nil {
		logger.ErrorContext(ctx, "error generating OTP", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	otpExpiresAt := time.Now().Add(In10Minutes)

	if apiErr := ctrl.signinWithOTP(
		ctx,
		string(request.Body.Email),
		options,
		otp,
		otpExpiresAt,
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInOTPEmail200JSONResponse(api.OK), nil
}

func (ctrl *Controller) signinWithOTP(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	otp string,
	otpExpiresAt time.Time,
	logger *slog.Logger,
) *APIError {
	user, apiErr := ctrl.wf.GetUserByEmail(ctx, email, logger)

	switch {
	case errors.Is(apiErr, ErrUserEmailNotFound):
		if ctrl.config.DisableAutoSignup {
			logger.InfoContext(ctx, "auto-signup disabled, returning OK without sending email")
			return nil
		}

		logger.InfoContext(ctx, "user does not exist, creating user")

		user, apiErr = ctrl.signinWithOTPSignUp(ctx, email, options, otp, otpExpiresAt, logger)
		if apiErr != nil {
			return apiErr
		}
	case apiErr != nil && !errors.Is(apiErr, ErrUnverifiedUser):
		logger.ErrorContext(ctx, "error getting user by email", logError(apiErr))
		return apiErr
	default:
		if _, err := ctrl.wf.db.UpdateUserOTPHash(ctx, sql.UpdateUserOTPHashParams{
			ID:                user.ID,
			Otp:               otp,
			OtpHashExpiresAt:  sql.TimestampTz(otpExpiresAt),
			OtpMethodLastUsed: sql.Text("email"),
		}); err != nil {
			logger.ErrorContext(ctx, "error updating user OTP hash", logError(err))
			return ErrInternalServerError
		}
	}

	return ctrl.wf.SendEmail(
		ctx,
		email,
		user.Locale,
		LinkTypeNone,
		otp,
		deptr(options.RedirectTo),
		notifications.TemplateNameSigninOTP,
		user.DisplayName,
		email,
		"",
		"",
		logger,
	)
}

func (ctrl *Controller) signupWithOTP(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	otp string,
	otpExpiresAt time.Time,
	logger *slog.Logger,
) *APIError {
	user, apiErr := ctrl.signinWithOTPSignUp(ctx, email, options, otp, otpExpiresAt, logger)
	if apiErr != nil {
		return apiErr
	}

	return ctrl.wf.SendEmail(
		ctx,
		email,
		user.Locale,
		LinkTypeNone,
		otp,
		deptr(options.RedirectTo),
		notifications.TemplateNameSigninOTP,
		user.DisplayName,
		email,
		"",
		"",
		logger,
	)
}

func (ctrl *Controller) signinWithOTPSignUp(
	ctx context.Context,
	email string,
	options *api.SignUpOptions,
	otp string,
	otpExpiresAt time.Time,
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
				Ticket:            pgtype.Text{}, //nolint:exhaustruct
				TicketExpiresAt:   sql.TimestampTz(time.Now()),
				EmailVerified:     false,
				Locale:            deptr(options.Locale),
				DefaultRole:       deptr(options.DefaultRole),
				Metadata:          metadata,
				Roles:             deptr(options.AllowedRoles),
				PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
				Otp:               otp,
				OtpHashExpiresAt:  sql.TimestampTz(otpExpiresAt),
				OtpMethodLastUsed: sql.Text("email"),
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
		"",
		logger,
	)

	return user, apiErr
}
