package controller

import (
	"context"
	"log/slog"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostSigninPasswordlessSmsOtp( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninPasswordlessSmsOtpRequestObject,
) (api.PostSigninPasswordlessSmsOtpResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.Warn("SMS passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, err := ctrl.wf.sms.CheckVerificationCode(
		ctx, request.Body.PhoneNumber, request.Body.Otp,
	)
	if err != nil {
		logger.Warn("invalid OTP", slog.String("error", err.Error()))
		return ctrl.sendError(ErrInvalidOTP), nil
	}

	if err := ctrl.wf.ValidateUserEmailOptional(user, logger); err != nil {
		return ctrl.sendError(ErrInternalServerError), nil //nolint:nilerr
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSigninPasswordlessSmsOtp200JSONResponse{
		Session: session,
		Mfa:     nil,
	}, nil
}
