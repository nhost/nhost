package controller

import (
	"context"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) ElevateOTPEmail( //nolint:ireturn
	ctx context.Context,
	_ api.ElevateOTPEmailRequestObject,
) (api.ElevateOTPEmailResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OTPEmailEnabled {
		logger.WarnContext(ctx, "otp email is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	// GetUserFromJWTInContext rejects users whose email fails access control,
	// which includes users without an email address, so user.Email is always
	// set past this point.
	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	otp, err := generateOTP()
	if err != nil {
		logger.ErrorContext(ctx, "error generating OTP", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	// Elevation and signin OTPs deliberately share the users.otp_hash slot:
	// both prove control of the same inbox, verification here additionally
	// requires a valid JWT, and the last-requested code simply wins.
	if _, err := ctrl.wf.db.UpdateUserOTPHash(ctx, sql.UpdateUserOTPHashParams{
		ID:                user.ID,
		Otp:               otp,
		OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(In10Minutes)),
		OtpMethodLastUsed: sql.Text("email"),
	}); err != nil {
		logger.ErrorContext(ctx, "error updating user OTP hash", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	if apiErr := ctrl.wf.SendEmail(
		ctx,
		user.Email.String,
		user.Locale,
		LinkTypeNone,
		otp,
		ctrl.config.ClientURL.String(),
		notifications.TemplateNameSigninOTP,
		user.DisplayName,
		user.Email.String,
		"",
		"",
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.ElevateOTPEmail200JSONResponse(api.OK), nil
}
