package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2Revoke( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2RevokeRequestObject,
) (api.Oauth2RevokeResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2RevokeError("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2RevokeError("invalid_request", "Missing request body"), nil
	}

	extractBasicAuthCredentials(ctx, &request.Body.ClientId, &request.Body.ClientSecret)

	oauthErr := ctrl.oauth2.RevokeToken(ctx, request.Body, logger)
	if oauthErr != nil {
		return oauth2RevokeError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Revoke200Response{}, nil
}

func oauth2RevokeError(errCode string, description string) api.Oauth2RevokedefaultJSONResponse {
	return api.Oauth2RevokedefaultJSONResponse{
		StatusCode: oauth2provider.ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
