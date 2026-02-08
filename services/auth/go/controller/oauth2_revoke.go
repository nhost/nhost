package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
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

	ctrl.wf.oauth2RevokeToken(ctx, request.Body, logger)

	return api.Oauth2Revoke200Response{}, nil
}

func oauth2RevokeError(errCode string, description string) api.Oauth2RevokedefaultJSONResponse {
	return api.Oauth2RevokedefaultJSONResponse{
		StatusCode: oauth2ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
