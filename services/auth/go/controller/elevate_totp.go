package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) ElevateTotp( //nolint:ireturn
	ctx context.Context,
	request api.ElevateTotpRequestObject,
) (api.ElevateTotpResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.MfaEnabled {
		logger.WarnContext(ctx, "mfa disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if user.ActiveMfaType.String != string(api.Totp) {
		logger.WarnContext(ctx, "user does not have totp mfa enabled")
		return ctrl.sendError(ErrDisabledMfaTotp), nil
	}

	if user.TotpSecret.String == "" {
		logger.WarnContext(ctx, "user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret), nil
	}

	totpSecret, err := ctrl.encrypter.Decrypt([]byte(user.TotpSecret.String))
	if err != nil {
		logger.ErrorContext(ctx, "failed to decrypt totp secret", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	if !ctrl.totp.Validate(request.Body.Otp, string(totpSecret)) {
		logger.WarnContext(ctx, "invalid totp")
		return ctrl.sendError(ErrInvalidTotp), nil
	}

	session, err := ctrl.wf.NewSession(
		ctx,
		user,
		map[string]any{"x-hasura-auth-elevated": user.ID.String()},
		logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create elevated session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.ElevateTotp200JSONResponse{
		Session: session,
	}, nil
}
