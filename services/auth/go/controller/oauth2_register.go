package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2Register( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2RegisterRequestObject,
) (api.Oauth2RegisterResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2RegisterError("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2RegisterError("invalid_request", "Missing request body"), nil
	}

	resp, oauthErr := ctrl.oauth2.RegisterClient(ctx, request.Body, logger)
	if oauthErr != nil {
		return oauth2RegisterError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Register201JSONResponse(*resp), nil
}

func oauth2RegisterError(
	errCode string, description string,
) api.Oauth2RegisterdefaultJSONResponse {
	return api.Oauth2RegisterdefaultJSONResponse{
		StatusCode: oauth2provider.ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
