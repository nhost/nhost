package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifyElevateOTPSms( //nolint:ireturn
	ctx context.Context,
	request api.VerifyElevateOTPSmsRequestObject,
) (api.VerifyElevateOTPSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "sms passwordless is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContextEmailOptional(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if !smsFactorUsable(ctrl.config.SMSPasswordlessEnabled, user) {
		logger.WarnContext(ctx, "user has no usable SMS elevation factor")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	freshUser, apiErr := ctrl.wf.VerifySMSOTP(
		ctx, user.PhoneNumber.String, request.Body.Otp, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if freshUser.ID != user.ID {
		logger.WarnContext(ctx, "SMS OTP resolved to a different user")
		return ctrl.sendError(ErrInvalidOTP), nil
	}

	if apiErr := ctrl.wf.ValidateUserEmailOptional(ctx, freshUser, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(
		ctx,
		freshUser,
		map[string]any{"x-hasura-auth-elevated": user.ID.String()},
		logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create elevated session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifyElevateOTPSms200JSONResponse{Session: session}, nil
}
