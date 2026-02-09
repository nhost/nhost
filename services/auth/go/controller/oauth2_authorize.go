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

	params := authorizeParamsFromGet(request.Params)

	redirectURL, oauthErr := ctrl.wf.oauth2ValidateAuthorizeRequest(
		ctx, &ctrl.config, params, logger,
	)
	if oauthErr != nil {
		if redirectURL != "" {
			return api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: redirectURL,
				},
			}, nil
		}

		return ctrl.oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2Authorize302Response{
		Headers: api.Oauth2Authorize302ResponseHeaders{
			Location: redirectURL,
		},
	}, nil
}

func (ctrl *Controller) Oauth2AuthorizePost( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2AuthorizePostRequestObject,
) (api.Oauth2AuthorizePostResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return ctrl.oauth2PostError("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return ctrl.oauth2PostError("invalid_request", "Missing request body"), nil
	}

	params := authorizeParamsFromPost(request.Body)

	redirectURL, oauthErr := ctrl.wf.oauth2ValidateAuthorizeRequest(
		ctx, &ctrl.config, params, logger,
	)
	if oauthErr != nil {
		if redirectURL != "" {
			return api.Oauth2AuthorizePost302Response{
				Headers: api.Oauth2AuthorizePost302ResponseHeaders{
					Location: redirectURL,
				},
			}, nil
		}

		return ctrl.oauth2PostError(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2AuthorizePost302Response{
		Headers: api.Oauth2AuthorizePost302ResponseHeaders{
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

func (ctrl *Controller) oauth2PostError(
	errCode string, description string,
) api.Oauth2AuthorizePostdefaultJSONResponse {
	return api.Oauth2AuthorizePostdefaultJSONResponse{
		StatusCode: oauth2ErrorStatusCode(errCode),
		Body: api.OAuth2ErrorResponse{
			Error:            errCode,
			ErrorDescription: &description,
		},
	}
}
