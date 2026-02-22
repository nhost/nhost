package controller

import (
	"context"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) GetOpenIDConfiguration( //nolint:ireturn
	ctx context.Context,
	_ api.GetOpenIDConfigurationRequestObject,
) (api.GetOpenIDConfigurationResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	return api.GetOpenIDConfiguration200JSONResponse(ctrl.oauth2.BuildDiscoveryResponse()), nil
}

func (ctrl *Controller) GetOAuthAuthorizationServer( //nolint:ireturn
	ctx context.Context,
	_ api.GetOAuthAuthorizationServerRequestObject,
) (api.GetOAuthAuthorizationServerResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	return api.GetOAuthAuthorizationServer200JSONResponse(
		ctrl.oauth2.BuildDiscoveryResponse(),
	), nil
}

func (ctrl *Controller) Oauth2Jwks( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2JwksRequestObject,
) (api.Oauth2JwksResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		logger.WarnContext(ctx, "OAuth2 provider is disabled")

		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	return api.Oauth2Jwks200JSONResponse{Keys: ctrl.oauth2.JWKS()}, nil
}
