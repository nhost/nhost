package controller

import (
	"context"
	"net/http"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2LoginGet( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2LoginGetRequestObject,
) (api.Oauth2LoginGetResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return api.Oauth2LoginGetdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.DisabledEndpoint,
				Message: "OAuth2 provider is disabled",
			},
		}, nil
	}

	resp, oauthErr := ctrl.oauth2.GetLoginRequest(ctx, request.Params.RequestId, logger)
	if oauthErr != nil {
		statusCode := oauth2provider.ErrorStatusCode(oauthErr.Err)

		return api.Oauth2LoginGetdefaultJSONResponse{
			StatusCode: statusCode,
			Body: api.ErrorResponse{
				Status:  statusCode,
				Error:   api.InvalidRequest,
				Message: oauthErr.Description,
			},
		}, nil
	}

	return api.Oauth2LoginGet200JSONResponse(*resp), nil
}

func (ctrl *Controller) Oauth2LoginPost( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2LoginPostRequestObject,
) (api.Oauth2LoginPostResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.DisabledEndpoint,
				Message: "OAuth2 provider is disabled",
			},
		}, nil
	}

	if request.Body == nil {
		return api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.InvalidRequest,
				Message: "Missing request body",
			},
		}, nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	resp, oauthErr := ctrl.oauth2.CompleteLogin(ctx, request.Body.RequestId, user.ID, logger)
	if oauthErr != nil {
		statusCode := oauth2provider.ErrorStatusCode(oauthErr.Err)

		return api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: statusCode,
			Body: api.ErrorResponse{
				Status:  statusCode,
				Error:   api.InvalidRequest,
				Message: oauthErr.Description,
			},
		}, nil
	}

	return api.Oauth2LoginPost200JSONResponse(*resp), nil
}
