package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostSigninMfaTotp( //nolint:ireturn
	ctx context.Context, req api.PostSigninMfaTotpRequestObject,
) (api.PostSigninMfaTotpResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.MfaEnabled {
		logger.Warn("mfa disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserByTicket(ctx, req.Body.Ticket, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if user.ActiveMfaType.String != string(api.Totp) {
		logger.Warn("user does not have totp mfa enabled")
		return ctrl.sendError(ErrDisabledMfaTotp), nil
	}

	if user.TotpSecret.String == "" {
		logger.Warn("user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret), nil
	}

	valid := ctrl.totp.Validate(req.Body.Otp, user.TotpSecret.String)
	if !valid {
		logger.Warn("invalid totp")
		return ctrl.sendError(ErrInvalidTotp), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSigninMfaTotp200JSONResponse{
		Session: session,
	}, nil
}
