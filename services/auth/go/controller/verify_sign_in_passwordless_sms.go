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

	// Anonymous passwordless OTP verification is also the final step of a
	// previously-staged SMS deanonymization. Without staged options, the
	// confirmation deliberately changes no authorization state; the refreshed
	// user remains anonymous and is rejected by the validation below.
	if user.IsAnonymous {
		if apiErr := ctrl.wf.CompleteDeanonymizeSMS(ctx, user.ID, logger); apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}

		refreshedUser, apiErr := ctrl.wf.getUserEmailOptional(ctx, user.ID, logger)
		if apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}

		user = refreshedUser
	} else if apiErr := ctrl.wf.ValidateUserEmailOptional(ctx, user, logger); apiErr != nil {
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
