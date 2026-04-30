package controller

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) postUserDeanonymizeSMSValidateRequest(
	ctx context.Context,
	request api.DeanonymizeUserSMSRequestObject,
	logger *slog.Logger,
) (uuid.UUID, *api.SignUpOptions, *APIError) {
	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.ErrorContext(
			ctx,
			"jwt token not found in context, this should not be possilble due to middleware",
		)

		return uuid.UUID{}, nil, ErrInternalServerError
	}

	if !ctrl.wf.jwtGetter.IsAnonymous(jwtToken) {
		logger.ErrorContext(ctx, "user is not anonymous")
		return uuid.UUID{}, nil, ErrUserNotAnonymous
	}

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return uuid.UUID{}, nil, ErrInvalidRequest
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(
		ctx, request.Body.Options, request.Body.PhoneNumber, logger,
	)
	if apiErr != nil {
		return uuid.UUID{}, nil, apiErr
	}

	exists, apiErr := ctrl.wf.UserByPhoneNumberExists(ctx, request.Body.PhoneNumber, logger)
	if apiErr != nil {
		return uuid.UUID{}, nil, apiErr
	}

	if exists {
		logger.WarnContext(ctx, "phone number already exists")
		return uuid.UUID{}, nil, ErrUserAlreadyExists
	}

	return userID, options, nil
}

func (ctrl *Controller) DeanonymizeUserSMS(
	ctx context.Context, request api.DeanonymizeUserSMSRequestObject,
) (api.DeanonymizeUserSMSResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("phoneNumber", request.Body.PhoneNumber))

	if !ctrl.config.SMSPasswordlessEnabled {
		logger.WarnContext(ctx, "SMS passwordless is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	userID, options, apiError := ctrl.postUserDeanonymizeSMSValidateRequest(
		ctx, request, logger,
	)
	if apiError != nil {
		return ctrl.sendError(apiError), nil
	}

	otp, expiresAt, err := ctrl.wf.sms.SendVerificationCode(
		ctx, request.Body.PhoneNumber, *options.Locale,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error sending SMS verification code", logError(err))
		return ctrl.sendError(ErrCannotSendSMS), nil
	}

	if apiError = ctrl.wf.DeanonymizeUserSMS(
		ctx,
		userID,
		request.Body.PhoneNumber,
		otp,
		expiresAt,
		options,
		logger,
	); apiError != nil {
		return ctrl.sendError(apiError), nil
	}

	return api.DeanonymizeUserSMS200JSONResponse(api.OK), nil
}
