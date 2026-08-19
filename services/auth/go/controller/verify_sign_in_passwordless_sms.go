package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

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

	user, outcome, err := ctrl.wf.sms.CheckVerificationCode(
		ctx, request.Body.PhoneNumber, request.Body.Otp,
	)
	if err != nil {
		if sqlIsDuplcateError(err, "users_phone_number_key") {
			logger.ErrorContext(
				ctx,
				"phone number promotion conflict during SMS passwordless verification",
				slog.String("constraint", "users_phone_number_key"),
				logError(err),
			)

			return ctrl.sendError(ErrInvalidOTP), nil
		}

		logger.WarnContext(ctx, "invalid OTP", logError(err))

		return ctrl.sendError(ErrInvalidOTP), nil
	}

	switch outcome {
	case smsOTPOutcomeVerified, smsOTPOutcomePromoted:
	default:
		logger.ErrorContext(
			ctx,
			"unexpected SMS OTP verification outcome",
			slog.String("outcome", outcome),
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
