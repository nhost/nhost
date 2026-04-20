package controller

import (
	"context"
	"errors"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) SignInPasswordlessSms( //nolint:ireturn
	ctx context.Context,
	request api.SignInPasswordlessSmsRequestObject,
) (api.SignInPasswordlessSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.signinSmsValidateRequest(
		ctx, request.Body.PhoneNumber, request.Body.Options, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	user, apiErr := ctrl.wf.GetUserByPhoneNumber(ctx, request.Body.PhoneNumber, logger)
	switch {
	case errors.Is(apiErr, ErrUserPhoneNumberNotFound):
		if ctrl.config.DisableAutoSignup {
			// Return OK to prevent account enumeration - don't send SMS
			logger.InfoContext(ctx, "auto-signup disabled, returning OK without sending SMS")
			return api.SignInPasswordlessSms200JSONResponse(api.OK), nil
		}

		logger.InfoContext(ctx, "user does not exist, creating user")

		if apiErr := ctrl.postSigninPasswordlessSmsSignup(
			ctx, request.Body.PhoneNumber, options, logger,
		); apiErr != nil {
			logger.ErrorContext(ctx, "error signing up user", logError(apiErr))
			return ctrl.respondWithError(apiErr), nil
		}

		return api.SignInPasswordlessSms200JSONResponse(api.OK), nil
	case apiErr != nil:
		logger.ErrorContext(ctx, "error getting user by phone number", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	if apiErr := ctrl.postSigninPasswordlessSmsSignin(ctx, user, logger); apiErr != nil {
		logger.ErrorContext(ctx, "error signing in user", logError(apiErr))
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInPasswordlessSms200JSONResponse(api.OK), nil
}

func (ctrl *Controller) signinSmsValidateRequest(
	ctx context.Context,
	phoneNumber string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	options, apiErr := ctrl.wf.ValidateSignUpOptions(ctx, options, phoneNumber, logger)
	if apiErr != nil {
		return nil, apiErr
	}

	return options, nil
}

func (ctrl *Controller) postSigninPasswordlessSmsSignin(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) *APIError {
	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx,
		user.PhoneNumber.String,
		user.Locale,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ErrCannotSendSMS
	}

	if _, err := ctrl.wf.db.UpdateUserOTPHash(ctx, sql.UpdateUserOTPHashParams{
		ID:                user.ID,
		Otp:               otp,
		OtpHashExpiresAt:  sql.TimestampTz(expiresAt),
		OtpMethodLastUsed: sql.Text("sms"),
	}); err != nil {
		logger.ErrorContext(ctx, "error updating user OTP hash", logError(err))
		return ErrInternalServerError
	}

	return nil
}
