package controller

import (
	"context"
	"encoding/base64"
	"log/slog"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func webauthnCredentials(
	keys []sql.AuthUserSecurityKey, logger *slog.Logger,
) ([]webauthn.Credential, *APIError) {
	creds := make([]webauthn.Credential, len(keys))
	for i, key := range keys {
		credID := make([]byte, base64.RawURLEncoding.DecodedLen(len(key.CredentialID)))
		if _, err := base64.RawURLEncoding.Decode(credID, []byte(key.CredentialID)); err != nil {
			logger.Error("failed to decode credential ID",
				logError(err), slog.String("credential_id", key.CredentialID))
			return nil, ErrInternalServerError
		}

		creds[i] = webauthn.Credential{
			ID:              credID,
			PublicKey:       key.CredentialPublicKey,
			AttestationType: "",
			Transport:       []protocol.AuthenticatorTransport{},
			Flags:           webauthn.CredentialFlags{},       //nolint:exhaustruct
			Authenticator:   webauthn.Authenticator{},         //nolint:exhaustruct
			Attestation:     webauthn.CredentialAttestation{}, //nolint:exhaustruct
		}
	}

	return creds, nil
}

func (ctrl *Controller) postSigninWebauthnDiscoverableLogin( //nolint:ireturn
	logger *slog.Logger,
) (api.PostSigninWebauthnResponseObject, error) {
	creation, apiErr := ctrl.Webauthn.BeginDiscoverableLogin(logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.PostSigninWebauthn200JSONResponse(creation.Response), nil
}

func (ctrl *Controller) PostSigninWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninWebauthnRequestObject,
) (api.PostSigninWebauthnResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.Error("webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	if request.Body.Email == nil {
		return ctrl.postSigninWebauthnDiscoverableLogin(logger)
	}

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(*request.Body.Email), logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	keys, apiErr := ctrl.wf.GetUserSecurityKeys(ctx, user.ID, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	creds, apiErr := webauthnCredentials(keys, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	waUser := WebauthnUser{
		ID:           user.ID,
		Name:         user.DisplayName,
		Email:        user.Email.String,
		Credentials:  creds,
		Discoverable: false,
	}

	creation, apiErr := ctrl.Webauthn.BeginLogin(waUser, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.PostSigninWebauthn200JSONResponse(creation.Response), nil
}
