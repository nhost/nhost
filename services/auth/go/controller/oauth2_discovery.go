package controller

import (
	"context"
	"net/http"

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

		return api.GetOpenIDConfigurationdefaultJSONResponse{
			StatusCode: http.StatusNotFound,
			Body: api.OAuth2ErrorResponse{
				Error:            "server_error",
				ErrorDescription: new("OAuth2 provider is disabled"),
			},
		}, nil
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

		return api.GetOAuthAuthorizationServerdefaultJSONResponse{
			StatusCode: http.StatusNotFound,
			Body: api.OAuth2ErrorResponse{
				Error:            "server_error",
				ErrorDescription: new("OAuth2 provider is disabled"),
			},
		}, nil
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

		return api.Oauth2Jwks200JSONResponse{Keys: nil}, nil
	}

	jwks := ctrl.oauth2.JWKS()

	keys := make([]struct {
		Alg *string `json:"alg,omitempty"`
		E   *string `json:"e,omitempty"`
		Kid *string `json:"kid,omitempty"`
		Kty *string `json:"kty,omitempty"`
		N   *string `json:"n,omitempty"`
		Use *string `json:"use,omitempty"`
	}, len(jwks))

	for i, k := range jwks {
		keys[i] = struct {
			Alg *string `json:"alg,omitempty"`
			E   *string `json:"e,omitempty"`
			Kid *string `json:"kid,omitempty"`
			Kty *string `json:"kty,omitempty"`
			N   *string `json:"n,omitempty"`
			Use *string `json:"use,omitempty"`
		}{
			Alg: new(k.Alg),
			E:   new(k.E),
			Kid: new(k.Kid),
			Kty: new(k.Kty),
			N:   new(k.N),
			Use: new(k.Use),
		}
	}

	return api.Oauth2Jwks200JSONResponse{Keys: keys}, nil
}
