package controller

import (
	"context"
	"errors"
	"log/slog"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
)

func (ctrl *Controller) SignUpOTPEmail( //nolint:ireturn
	ctx context.Context,
	request api.SignUpOTPEmailRequestObject,
) (api.SignUpOTPEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	if !ctrl.config.OTPEmailEnabled {
		logger.WarnContext(ctx, "otp email signup is disabled")
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
	// the same 200 OK (with no OTP sent) whether the user exists or not —
	// mirroring the signin endpoints' behaviour under AUTH_DISABLE_AUTO_SIGNUP.
	_, apiErr = ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	switch {
	case apiErr == nil, errors.Is(apiErr, ErrUnverifiedUser):
		logger.InfoContext(ctx, "user already exists, returning OK without sending OTP")
		return api.SignUpOTPEmail200JSONResponse(api.OK), nil
	case errors.Is(apiErr, ErrUserEmailNotFound):
		// User does not exist, proceed with signup
	default:
		logger.ErrorContext(ctx, "error getting user by email", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	otp, err := generateOTP()
	if err != nil {
		logger.ErrorContext(ctx, "error generating OTP", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	ticketExpiresAt := time.Now().Add(time.Hour)

	// Call signupWithTicket directly since we've already verified user doesn't exist.
	// OTP email is not a magic-link flow so PKCE does not apply.
	if apiErr := ctrl.signupWithTicket(
		ctx,
		string(request.Body.Email),
		options,
		otp,
		ticketExpiresAt,
		notifications.TemplateNameSigninOTP,
		LinkTypeNone,
		"",
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignUpOTPEmail200JSONResponse(api.OK), nil
}
