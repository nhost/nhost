package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) Oauth2Introspect( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2IntrospectRequestObject,
) (api.Oauth2IntrospectResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2Error("invalid_request", "Missing request body"), nil
	}

	if err := extractBasicAuthCredentials(
		ctx,
		&request.Body.ClientId,
		&request.Body.ClientSecret,
	); err != nil {
		return oauth2Error("invalid_request", err.Error()), nil
	}

	resp, oauthErr := ctrl.oauth2.IntrospectToken(
		ctx, request.Body, logger,
	)
	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Introspect200JSONResponse(*resp), nil
}
