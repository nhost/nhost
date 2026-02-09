package controller

import (
	"context"

	"github.com/gin-gonic/gin"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) Oauth2Token( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2TokenRequestObject,
) (api.Oauth2TokenResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2TokenError("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2TokenError("invalid_request", "Missing request body"), nil
	}

	extractBasicAuthCredentials(ctx, request.Body)

	var (
		resp     *api.OAuth2TokenResponse
		oauthErr *OAuth2Error
	)

	switch request.Body.GrantType {
	case api.AuthorizationCode:
		resp, oauthErr = ctrl.wf.oauth2ExchangeCode(
			ctx, &ctrl.config, request.Body, logger,
		)
	case api.RefreshToken:
		resp, oauthErr = ctrl.wf.oauth2RefreshToken(
			ctx, &ctrl.config, request.Body, logger,
		)
	default:
		return oauth2TokenError("unsupported_grant_type", "Unsupported grant_type"), nil
	}

	if oauthErr != nil {
		return oauth2TokenError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Token200JSONResponse(*resp), nil
}

func oauth2TokenError(errCode string, description string) api.Oauth2TokendefaultJSONResponse {
	return api.Oauth2TokendefaultJSONResponse{
		StatusCode: oauth2ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}

// extractBasicAuthCredentials supports client_secret_basic (RFC 6749 Section 2.3.1)
// by extracting client credentials from the Authorization: Basic header
// when they are not provided in the request body.
func extractBasicAuthCredentials(
	ctx context.Context,
	body *api.OAuth2TokenRequest,
) {
	if body.ClientId != nil && body.ClientSecret != nil {
		return
	}

	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return
	}

	clientID, clientSecret, ok := ginCtx.Request.BasicAuth()
	if !ok {
		return
	}

	if body.ClientId == nil {
		body.ClientId = &clientID
	}

	if body.ClientSecret == nil {
		body.ClientSecret = &clientSecret
	}
}
