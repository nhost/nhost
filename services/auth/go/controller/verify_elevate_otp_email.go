package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifyElevateOTPEmail( //nolint:ireturn
	ctx context.Context,
	request api.VerifyElevateOTPEmailRequestObject,
) (api.VerifyElevateOTPEmailResponseObject, error) {
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

	// The email comes from the JWT-bound user row, so a caller can only ever
	// burn attempts on their own OTP.
	freshUser, apiErr := ctrl.wf.VerifyEmailOTP(
		ctx, user.Email.String, request.Body.Otp, logger,
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

	return api.VerifyElevateOTPEmail200JSONResponse{
		Session: session,
	}, nil
}
