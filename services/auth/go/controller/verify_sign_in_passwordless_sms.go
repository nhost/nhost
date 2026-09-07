package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func smsVerificationError(ctx context.Context, err error, logger *slog.Logger) *APIError {
	switch {
	case sqlIsDuplcateError(err, "users_phone_number_key"):
		logger.ErrorContext(
			ctx,
			"phone number promotion conflict during SMS passwordless verification",
			slog.String("constraint", "users_phone_number_key"),
			logError(err),
		)

		return ErrInvalidOTP
	case sqlIsForeignKeyError(err, "fk_role"),
		sqlIsForeignKeyError(err, "fk_default_role"):
		logger.ErrorContext(
			ctx,
			"staged deanonymization carries a role that no longer exists",
			logError(err),
		)

		return ErrRoleNotAllowed
	default:
		logger.ErrorContext(ctx, "error verifying SMS OTP", logError(err))

		return ErrInternalServerError
	}
}

func (ctrl *Controller) VerifySignInPasswordlessSms( //nolint:ireturn
	ctx context.Context,
	request api.VerifySignInPasswordlessSmsRequestObject,
) (api.VerifySignInPasswordlessSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, status, err := ctrl.wf.sms.CheckVerificationCode(
		ctx, request.Body.PhoneNumber, request.Body.Otp,
	)
	if err != nil {
		return ctrl.sendError(smsVerificationError(ctx, err, logger)), nil
	}

	switch status {
	case sql.OTPStatusOK:
	case sql.OTPStatusBurned:
		logger.WarnContext(ctx, "sms otp burned after too many attempts")
		return ctrl.sendError(ErrTooManyOTPAttempts), nil
	case sql.OTPStatusInvalid:
		logger.WarnContext(ctx, "invalid OTP")
		return ctrl.sendError(ErrInvalidOTP), nil
	default:
		logger.ErrorContext(
			ctx,
			"unexpected SMS OTP verification status",
			slog.String("status", status),
		)

		return ctrl.sendError(ErrInternalServerError), nil
	}

	if apiErr := ctrl.wf.ValidateUserEmailOptional(ctx, user, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifySignInPasswordlessSms200JSONResponse{
		Session: session,
		Mfa:     nil,
	}, nil
}
