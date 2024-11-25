package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostSigninWebauthnVerify( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninWebauthnVerifyRequestObject,
) (api.PostSigninWebauthnVerifyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.Error("webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.Error("error parsing credential data", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	_, webauthnUser, apiErr := ctrl.Webauthn.FinishLogin(credData, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	user, apiErr := ctrl.wf.GetUser(ctx, webauthnUser.ID, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, logger)
	if err != nil {
		logger.Error("failed to create session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSigninWebauthnVerify200JSONResponse{
		Session: session,
	}, nil
}
