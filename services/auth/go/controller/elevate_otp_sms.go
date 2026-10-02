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

	if !ctrl.config.OTPSmsEnabled {
		logger.WarnContext(ctx, "otp sms is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	// Same checks as GetUserFromJWTInContext, except the email allow/block-list
	// and email-verified ones only run when the user actually has an address.
	// A phone-only account must not be locked out of its own second factor for
	// lacking an email; one that has an email is validated exactly as elsewhere.
	user, apiErr := ctrl.wf.getUserFromJWTInContextEmailOptional(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if !hasVerifiedPhoneNumber(user) {
		logger.WarnContext(ctx, "user has no usable SMS elevation factor")
		return ctrl.sendError(ErrUserPhoneNumberNotFound), nil
	}

	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx, user.PhoneNumber.String, user.Locale,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ctrl.sendError(ErrCannotSendSMS), nil
	}

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
