package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) ChangeUserPhoneNumber( //nolint:ireturn
	ctx context.Context, request api.ChangeUserPhoneNumberRequestObject,
) (api.ChangeUserPhoneNumberResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("newPhoneNumber", request.Body.NewPhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	exists, apiErr := ctrl.wf.PhoneNumberClaimedByOtherUser(
		ctx, user.ID, request.Body.NewPhoneNumber, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if exists {
		logger.WarnContext(ctx, "phone number already in use")
		return ctrl.sendError(ErrUserAlreadyExists), nil
	}

	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx, request.Body.NewPhoneNumber, user.Locale,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ctrl.sendError(ErrCannotSendSMS), nil
	}

	if apiErr := ctrl.wf.ChangePhoneNumber(
		ctx, user.ID, request.Body.NewPhoneNumber, otp, expiresAt, logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.ChangeUserPhoneNumber200JSONResponse(api.OK), nil
}

func (ctrl *Controller) VerifyChangeUserPhoneNumber( //nolint:ireturn
	ctx context.Context, request api.VerifyChangeUserPhoneNumberRequestObject,
) (api.VerifyChangeUserPhoneNumberResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("newPhoneNumber", request.Body.NewPhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if _, apiErr := ctrl.wf.ConfirmChangePhoneNumber(
		ctx, user.ID, request.Body.NewPhoneNumber, request.Body.Otp, logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.VerifyChangeUserPhoneNumber200JSONResponse(api.OK), nil
}
