package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
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

	user, apiErr := ctrl.wf.VerifySMSOTP(
		ctx, request.Body.PhoneNumber, request.Body.Otp, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
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
