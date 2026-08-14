package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) ElevateOTPSms( //nolint:ireturn
	ctx context.Context,
	_ api.ElevateOTPSmsRequestObject,
) (api.ElevateOTPSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "sms passwordless is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if !user.PhoneNumber.Valid || user.PhoneNumber.String == "" {
		logger.WarnContext(ctx, "user has no phone number")
		return ctrl.sendError(ErrUserPhoneNumberNotFound), nil
	}

	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx,
		user.PhoneNumber.String,
		user.Locale,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ctrl.sendError(ErrCannotSendSMS), nil
	}

	// Elevation and signin OTPs deliberately share the users.otp_hash slot.
	if _, err := ctrl.wf.db.UpdateUserOTPHash(ctx, sql.UpdateUserOTPHashParams{
		ID:                user.ID,
		Otp:               otp,
		OtpHashExpiresAt:  sql.TimestampTz(expiresAt),
		OtpMethodLastUsed: sql.Text("sms"),
	}); err != nil {
		logger.ErrorContext(ctx, "error updating user OTP hash", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.ElevateOTPSms200JSONResponse(api.OK), nil
}
