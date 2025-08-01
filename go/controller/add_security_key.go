package controller

import (
	"context"
	"errors"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) AddSecurityKey( //nolint:ireturn
	ctx context.Context,
	_ api.AddSecurityKeyRequestObject,
) (api.AddSecurityKeyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	keys, apiErr := ctrl.wf.GetUserSecurityKeys(ctx, user.ID, logger)
	switch {
	case errors.Is(apiErr, ErrSecurityKeyNotFound):
	case apiErr != nil:
		return ctrl.sendError(apiErr), nil
	}

	creds, apiErr := webauthnCredentials(ctx, keys, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credsDescriptors := make([]protocol.CredentialDescriptor, len(creds))
	for i, cred := range creds {
		credsDescriptors[i] = cred.Descriptor()
	}

	waUser := WebauthnUser{
		ID:           user.ID,
		Name:         user.DisplayName,
		Email:        user.Email.String,
		Credentials:  creds,
		Discoverable: false,
	}

	creation, apiErr := ctrl.Webauthn.BeginRegistration(
		ctx,
		waUser, nil, logger,
		webauthn.WithExclusions(credsDescriptors),
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.AddSecurityKey200JSONResponse(creation.Response), nil
}
