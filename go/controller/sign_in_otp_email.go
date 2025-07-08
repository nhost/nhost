package controller

import (
	"context"
	"log/slog"
	"time"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
)

func (ctrl *Controller) SignInOTPEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignInOTPEmailRequestObject,
) (api.SignInOTPEmailResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.OTPEmailEnabled {
		logger.Warn("otp email signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		string(request.Body.Email), request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	otp, _, err := GenerateOTP()
	if err != nil {
		logger.Error("error generating OTP", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}
	ticketExpiresAt := time.Now().Add(time.Hour)

	if apiErr := ctrl.signinWithTicket(
		ctx,
		string(request.Body.Email),
		options,
		otp,
		ticketExpiresAt,
		notifications.TemplateNameSigninOTP,
		LinkTypeNone,
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInOTPEmail200JSONResponse(api.OK), nil
}
