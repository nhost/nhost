package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
)

func (ctrl *Controller) VerifySignInWebauthnUserHandle(
	ctx context.Context,
	response *protocol.ParsedCredentialAssertionData,
	logger *slog.Logger,
) webauthn.DiscoverableUserHandler {
	return func(_, userHandle []byte) (webauthn.User, error) {
		// we need to encoide it back because the client treats it as a string including the hyphens
		b, err := json.Marshal(protocol.URLEncodedBase64(userHandle))
		if err != nil {
			return nil, fmt.Errorf("failed to marshal user handle: %w", err)
		}

		userID, err := uuid.Parse(string(b))
		if err != nil {
			return nil, fmt.Errorf("failed to parse user ID: %w", err)
		}

		keys, apiErr := ctrl.wf.GetUserSecurityKeys(ctx, userID, logger)
		if apiErr != nil {
			return nil, apiErr
		}

		creds, apiErr := webauthnCredentials(ctx, keys, logger)
		if apiErr != nil {
			return nil, apiErr
		}

		// we don't track the flags so we just copy them
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

		response.Response.UserHandle = []byte(userID.String())

		return WebauthnUser{
			ID:           userID,
			Name:         "",
			Email:        "",
			Credentials:  creds,
			Discoverable: true,
		}, nil
	}
}

func (ctrl *Controller) VerifySignInWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.VerifySignInWebauthnRequestObject,
) (api.VerifySignInWebauthnResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.ErrorContext(ctx, "error parsing credential data", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	_, _, apiErr := ctrl.Webauthn.FinishLogin(
		ctx,
		credData,
		ctrl.VerifySignInWebauthnUserHandle(ctx, credData, logger),
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	userID, err := uuid.Parse(string(credData.Response.UserHandle))
	if err != nil {
		return nil, fmt.Errorf("failed to parse user ID: %w", err)
	}

	user, apiErr := ctrl.wf.GetUser(ctx, userID, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "failed to create session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifySignInWebauthn200JSONResponse{
		Session: session,
	}, nil
}
