package controller

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	"github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
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
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.OTPEmailEnabled {
		logger.WarnContext(ctx, "otp email signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinEmailValidateRequest(
		ctx, string(request.Body.Email), request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	otp, err := generateOTP()
	if err != nil {
		logger.ErrorContext(ctx, "error generating OTP", logError(err))
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
