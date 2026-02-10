package controller

import (
	"context"
	"net/http"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
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
		return api.Oauth2LoginGetdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
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

	userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return api.Oauth2LoginPostdefaultJSONResponse{ //nolint:nilerr
			StatusCode: http.StatusUnauthorized,
			Body: api.ErrorResponse{
				Status:  http.StatusUnauthorized,
				Error:   api.InvalidRequest,
				Message: "Authentication required",
			},
		}, nil
	}

	resp, oauthErr := ctrl.oauth2.CompleteLogin(ctx, request.Body.RequestId, userID, logger)
	if oauthErr != nil {
		return api.Oauth2LoginPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.InvalidRequest,
				Message: oauthErr.Description,
			},
		}, nil
	}

	return api.Oauth2LoginPost200JSONResponse(*resp), nil
}
