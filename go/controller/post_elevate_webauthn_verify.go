package controller

import (
	"bytes"
	"context"
	"log/slog"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) PostElevateWebauthnVerify( //nolint:ireturn
	ctx context.Context,
	request api.PostElevateWebauthnVerifyRequestObject,
) (api.PostElevateWebauthnVerifyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.Error("webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	// Get the authenticated user from JWT context
	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.Error("error parsing credential data", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	_, _, apiErr = ctrl.Webauthn.FinishLogin(
		credData,
		ctrl.postElevateWebauthnVerifyUserHandler(ctx, user, credData, logger),
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	// Create new session with elevated claim
	session, err := ctrl.wf.NewSession(
		ctx,
		user,
		map[string]any{"x-hasura-auth-elevated": user.ID.String()},
		logger,
	)
	if err != nil {
		logger.Error("failed to create elevated session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostElevateWebauthnVerify200JSONResponse{
		Session: session,
	}, nil
}

func (ctrl *Controller) postElevateWebauthnVerifyUserHandler(
	ctx context.Context,
	user sql.AuthUser,
	response *protocol.ParsedCredentialAssertionData,
	logger *slog.Logger,
) webauthn.DiscoverableUserHandler {
	return func(_, _ []byte) (webauthn.User, error) {
		// For elevate, we already know the user from the JWT context
		keys, apiErr := ctrl.wf.GetUserSecurityKeys(ctx, user.ID, logger)
		if apiErr != nil {
			return nil, apiErr
		}

		creds, apiErr := webauthnCredentials(keys, logger)
		if apiErr != nil {
			return nil, apiErr
		}

		// Update flags from the webauthn response
		for i, userCreds := range creds {
			if bytes.Equal(response.RawID, userCreds.ID) {
				userCreds.Flags = webauthn.CredentialFlags{
					UserPresent:    response.Response.AuthenticatorData.Flags.UserPresent(),
					UserVerified:   response.Response.AuthenticatorData.Flags.UserVerified(),
					BackupEligible: response.Response.AuthenticatorData.Flags.HasBackupEligible(),
					BackupState:    response.Response.AuthenticatorData.Flags.HasBackupState(),
				}
				creds[i] = userCreds
			}
		}

		return WebauthnUser{
			ID:           user.ID,
			Name:         user.DisplayName,
			Email:        user.Email.String,
			Credentials:  creds,
			Discoverable: false,
		}, nil
	}
}
