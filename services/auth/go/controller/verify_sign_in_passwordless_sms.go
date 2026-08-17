package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
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
		if sqlIsDuplcateError(err, "users_phone_number_key") {
			logger.ErrorContext(
				ctx,
				"phone number promotion conflict during SMS passwordless verification",
				slog.String("constraint", "users_phone_number_key"),
				logError(err),
			)

			return ctrl.sendError(ErrInvalidOTP), nil
		}

		logger.WarnContext(ctx, "invalid OTP", logError(err))

		return ctrl.sendError(ErrInvalidOTP), nil
	}

	// Anonymous passwordless OTP verification also completes a previously staged
	// SMS deanonymization. Without staged options, the refreshed user remains
	// anonymous and validation still rejects it.
	if user.IsAnonymous {
		refreshedUser, apiErr := ctrl.completeSMSDeanonymization(ctx, user, logger)
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

func (ctrl *Controller) completeSMSDeanonymization(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	if user.PendingSmsDeanonymizeOptions != nil {
		deanonymizedUser := user
		deanonymizedUser.IsAnonymous = false

		if apiErr := ctrl.wf.ValidateUserEmailOptional(
			ctx, deanonymizedUser, logger,
		); apiErr != nil {
			return sql.AuthUser{}, apiErr
		}
	}

	if apiErr := ctrl.wf.CompleteDeanonymizeSMS(ctx, user.ID, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr
	}

	return ctrl.wf.getUserEmailOptional(ctx, user.ID, logger)
}
