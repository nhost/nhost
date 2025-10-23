package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func (ctrl *Controller) VerifySignInMfaTotp( //nolint:ireturn
	ctx context.Context, req api.VerifySignInMfaTotpRequestObject,
) (api.VerifySignInMfaTotpResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.MfaEnabled {
		logger.WarnContext(ctx, "mfa disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserByTicket(ctx, req.Body.Ticket, logger)
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

	valid := ctrl.totp.Validate(req.Body.Otp, string(totpSecret))
	if !valid {
		logger.WarnContext(ctx, "invalid totp")
		return ctrl.sendError(ErrInvalidTotp), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifySignInMfaTotp200JSONResponse{
		Session: session,
	}, nil
}
