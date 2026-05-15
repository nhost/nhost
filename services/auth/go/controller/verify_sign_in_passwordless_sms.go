package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifySignInPasswordlessSms( //nolint:ireturn
	ctx context.Context,
	request api.VerifySignInPasswordlessSmsRequestObject,
) (api.VerifySignInPasswordlessSmsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless signin is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, err := ctrl.wf.sms.CheckVerificationCode(
		ctx, request.Body.PhoneNumber, request.Body.Otp,
	)
	if err != nil {
		logger.WarnContext(ctx, "invalid OTP", slog.String("error", err.Error()))
		return ctrl.sendError(ErrInvalidOTP), nil
	}

	// If the user was still anonymous at OTP-check time, this verify call
	// completes a previously-staged SMS deanonymization: flip is_anonymous
	// and revoke the old anonymous refresh tokens. This must run before the
	// email validation below, which otherwise rejects anonymous users.
	if user.IsAnonymous {
		if apiErr := ctrl.wf.CompleteDeanonymizeSMS(ctx, user.ID, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}

		user.IsAnonymous = false
	}

	if err := ctrl.wf.ValidateUserEmailOptional(ctx, user, logger); err != nil {
		return ctrl.sendError(ErrInternalServerError), nil //nolint:nilerr
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifySignInPasswordlessSms200JSONResponse{
		Session: session,
		Mfa:     nil,
	}, nil
}
