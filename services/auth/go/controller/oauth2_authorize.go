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
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	var codeChallengeMethod *string
	if request.Params.CodeChallengeMethod != nil {
		codeChallengeMethod = (*string)(request.Params.CodeChallengeMethod)
	}

	params := api.Oauth2AuthorizePostFormdataBody{
		ClientId:            request.Params.ClientId,
		RedirectUri:         request.Params.RedirectUri,
		ResponseType:        request.Params.ResponseType,
		Scope:               request.Params.Scope,
		State:               request.Params.State,
		Nonce:               request.Params.Nonce,
		CodeChallenge:       request.Params.CodeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
		Resource:            request.Params.Resource,
		Prompt:              request.Params.Prompt,
	}

	redirectURL, oauthErr := ctrl.oauth2.ValidateAuthorizeRequest(
		ctx, params, logger,
	)
	if oauthErr != nil {
		if redirectURL != "" {
			return api.Oauth2Authorize302Response{
				Headers: api.Oauth2Authorize302ResponseHeaders{
					Location: redirectURL,
				},
			}, nil
		}

		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
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
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2Error("invalid_request", "Missing request body"), nil
	}

	params := api.Oauth2AuthorizePostFormdataBody(*request.Body)

	redirectURL, oauthErr := ctrl.oauth2.ValidateAuthorizeRequest(
		ctx, params, logger,
	)
	if oauthErr != nil {
		if redirectURL != "" {
			return api.Oauth2AuthorizePost302Response{
				Headers: api.Oauth2AuthorizePost302ResponseHeaders{
					Location: redirectURL,
				},
			}, nil
		}

		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2AuthorizePost302Response{
		Headers: api.Oauth2AuthorizePost302ResponseHeaders{
			Location: redirectURL,
		},
	}, nil
}
