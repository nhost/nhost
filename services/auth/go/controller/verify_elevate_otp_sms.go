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

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if !user.PhoneNumber.Valid || user.PhoneNumber.String == "" {
		logger.WarnContext(ctx, "user has no phone number")
		return ctrl.sendError(ErrUserPhoneNumberNotFound), nil
	}

	// Phone number comes from the JWT-bound row, never the request body, so a
	// caller can only burn attempts on their own OTP.
	freshUser, apiErr := ctrl.wf.VerifySMSOTP(
		ctx, user.PhoneNumber.String, request.Body.Otp, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(
		ctx,
		freshUser,
		map[string]any{"x-hasura-auth-elevated": freshUser.ID.String()},
		logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create elevated session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifyElevateOTPSms200JSONResponse{
		Session: session,
	}, nil
}
