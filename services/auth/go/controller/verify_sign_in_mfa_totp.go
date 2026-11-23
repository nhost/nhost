package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifySignInMfaTotp( //nolint:ireturn
	ctx context.Context, req api.VerifySignInMfaTotpRequestObject,
) (api.VerifySignInMfaTotpResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.TOTPEnabled {
		logger.WarnContext(ctx, "totp disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	// Don't consume the ticket yet so a mistyped code can be retried.
	user, apiErr := ctrl.wf.GetUserByActiveTicket(ctx, req.Body.Ticket, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if user.ActiveMfaType.String != string(api.UserMfaRequestActiveMfaTypeTotp) {
		logger.WarnContext(ctx, "user does not have totp enabled")
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

	user, apiErr = ctrl.wf.GetUserByTicket(ctx, req.Body.Ticket, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
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
