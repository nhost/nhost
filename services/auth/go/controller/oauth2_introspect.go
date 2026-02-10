package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2Introspect( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2IntrospectRequestObject,
) (api.Oauth2IntrospectResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2IntrospectError("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2IntrospectError("invalid_request", "Missing request body"), nil
	}

	resp := ctrl.oauth2.IntrospectToken(
		ctx, request.Body, logger,
	)

	return api.Oauth2Introspect200JSONResponse(*resp), nil
}

func oauth2IntrospectError(
	errCode string, description string,
) api.Oauth2IntrospectdefaultJSONResponse {
	return api.Oauth2IntrospectdefaultJSONResponse{
		StatusCode: oauth2provider.ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
