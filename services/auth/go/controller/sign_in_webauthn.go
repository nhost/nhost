package controller

import (
	"context"
	"encoding/base64"
	"log/slog"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func webauthnCredentials(
	ctx context.Context, keys []sql.AuthUserSecurityKey, logger *slog.Logger,
) ([]webauthn.Credential, *APIError) {
	creds := make([]webauthn.Credential, len(keys))
	for i, key := range keys {
		credID := make([]byte, base64.RawURLEncoding.DecodedLen(len(key.CredentialID)))
		if _, err := base64.RawURLEncoding.Decode(credID, []byte(key.CredentialID)); err != nil {
			logger.ErrorContext(ctx, "failed to decode credential ID",
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
	ctx context.Context, logger *slog.Logger,
) (api.SignInWebauthnResponseObject, error) {
	creation, apiErr := ctrl.Webauthn.BeginDiscoverableLogin(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignInWebauthn200JSONResponse(creation.Response), nil
}

func (ctrl *Controller) SignInWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.SignInWebauthnRequestObject,
) (api.SignInWebauthnResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	if request.Body.Email == nil {
		return ctrl.postSigninWebauthnDiscoverableLogin(ctx, logger)
	}

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(*request.Body.Email), logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	keys, apiErr := ctrl.wf.GetUserSecurityKeys(ctx, user.ID, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	creds, apiErr := webauthnCredentials(ctx, keys, logger)
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

	creation, apiErr := ctrl.Webauthn.BeginLogin(ctx, waUser, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignInWebauthn200JSONResponse(creation.Response), nil
}
