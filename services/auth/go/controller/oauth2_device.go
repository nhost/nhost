package controller

import (
	"context"
	"net/http"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	oauth2provider "github.com/nhost/nhost/services/auth/go/oauth2"
)

func (ctrl *Controller) Oauth2DeviceAuthorization( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2DeviceAuthorizationRequestObject,
) (api.Oauth2DeviceAuthorizationResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	if request.Body == nil {
		return oauth2Error("invalid_request", "Missing request body"), nil
	}

	resp, oauthErr := ctrl.oauth2.CreateDeviceAuthorization(ctx, request.Body, logger)
	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2DeviceAuthorization200JSONResponse(*resp), nil
}

func (ctrl *Controller) Oauth2DeviceVerifyGet( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2DeviceVerifyGetRequestObject,
) (api.Oauth2DeviceVerifyGetResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return api.Oauth2DeviceVerifyGetdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.DisabledEndpoint,
				Message: "OAuth2 provider is disabled",
			},
		}, nil
	}

	resp, oauthErr := ctrl.oauth2.GetDeviceVerification(
		ctx, request.Params.UserCode, logger,
	)
	if oauthErr != nil {
		statusCode := oauth2provider.ErrorStatusCode(oauthErr.Err)

		return api.Oauth2DeviceVerifyGetdefaultJSONResponse{
			StatusCode: statusCode,
			Body: api.ErrorResponse{
				Status:  statusCode,
				Error:   api.InvalidRequest,
				Message: oauthErr.Description,
			},
		}, nil
	}

	return api.Oauth2DeviceVerifyGet200JSONResponse(*resp), nil
}

func (ctrl *Controller) Oauth2DeviceVerifyPost( //nolint:ireturn
	ctx context.Context,
	request api.Oauth2DeviceVerifyPostRequestObject,
) (api.Oauth2DeviceVerifyPostResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return api.Oauth2DeviceVerifyPostdefaultJSONResponse{
			StatusCode: http.StatusBadRequest,
			Body: api.ErrorResponse{
				Status:  http.StatusBadRequest,
				Error:   api.DisabledEndpoint,
				Message: "OAuth2 provider is disabled",
			},
		}, nil
	}

	if request.Body == nil {
		return api.Oauth2DeviceVerifyPostdefaultJSONResponse{
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

	resp, oauthErr := ctrl.oauth2.CompleteDeviceVerification(
		ctx,
		request.Body.UserCode,
		user.ID,
		request.Body.Action,
		logger,
	)
	if oauthErr != nil {
		statusCode := oauth2provider.ErrorStatusCode(oauthErr.Err)

		return api.Oauth2DeviceVerifyPostdefaultJSONResponse{
			StatusCode: statusCode,
			Body: api.ErrorResponse{
				Status:  statusCode,
				Error:   api.InvalidRequest,
				Message: oauthErr.Description,
			},
		}, nil
	}

	return api.Oauth2DeviceVerifyPost200JSONResponse(*resp), nil
}
