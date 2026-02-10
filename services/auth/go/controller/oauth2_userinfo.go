package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2UserinfoGet( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2UserinfoGetRequestObject,
) (api.Oauth2UserinfoGetResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2UserinfoGetError("server_error", "OAuth2 provider is disabled"), nil
	}

	userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return oauth2UserinfoGetError("invalid_token", "Invalid access token"), nil //nolint:nilerr
	}

	resp, oauthErr := ctrl.oauth2.GetUserinfo(ctx, userID, logger)
	if oauthErr != nil {
		return oauth2UserinfoGetError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2UserinfoGet200JSONResponse(*resp), nil
}

func (ctrl *Controller) Oauth2UserinfoPost( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2UserinfoPostRequestObject,
) (api.Oauth2UserinfoPostResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2UserinfoPostError("server_error", "OAuth2 provider is disabled"), nil
	}

	userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return oauth2UserinfoPostError("invalid_token", "Invalid access token"), nil //nolint:nilerr
	}

	resp, oauthErr := ctrl.oauth2.GetUserinfo(ctx, userID, logger)
	if oauthErr != nil {
		return oauth2UserinfoPostError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2UserinfoPost200JSONResponse(*resp), nil
}

func oauth2UserinfoGetError(
	errCode string, description string,
) api.Oauth2UserinfoGetdefaultJSONResponse {
	return api.Oauth2UserinfoGetdefaultJSONResponse{
		StatusCode: oauth2provider.ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}

func oauth2UserinfoPostError(
	errCode string, description string,
) api.Oauth2UserinfoPostdefaultJSONResponse {
	return api.Oauth2UserinfoPostdefaultJSONResponse{
		StatusCode: oauth2provider.ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
