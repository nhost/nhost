package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) Oauth2Authorize( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2AuthorizeRequestObject,
) (api.Oauth2AuthorizeResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return ctrl.oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	_, redirectURL, oauthErr := ctrl.wf.oauth2ValidateAuthorizeRequest(
		ctx, &ctrl.config, request.Params, logger,
	)
	if oauthErr != nil {
		return ctrl.oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Authorize302Response{
		Headers: api.Oauth2Authorize302ResponseHeaders{
			Location: redirectURL,
		},
	}, nil
}

func (ctrl *Controller) oauth2Error(
	errCode string, description string,
) api.Oauth2AuthorizedefaultJSONResponse {
	return api.Oauth2AuthorizedefaultJSONResponse{
		StatusCode: oauth2ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
