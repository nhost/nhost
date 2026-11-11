package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) VerifyElevateWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.VerifyElevateWebauthnRequestObject,
) (api.VerifyElevateWebauthnResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	// Get the authenticated user from JWT context
	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.ErrorContext(ctx, "error parsing credential data", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	// elevation challenges are never discoverable so we don't pass a user handler
	_, webauthnUser, apiErr := ctrl.Webauthn.FinishLogin(ctx, credData, nil, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	// the challenge must have been issued to the user we are about to elevate
	if webauthnUser.ID != user.ID {
		logger.ErrorContext(ctx, "webauthn user ID mismatch")
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	// Create new session with elevated claim
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

	return api.VerifyElevateWebauthn200JSONResponse{
		Session: session,
	}, nil
}
