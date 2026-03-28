package controller

import (
	"context"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func scopesFromJWT(token *jwt.Token) []string {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil
	}

	scopeStr, ok := claims["scope"].(string)
	if !ok || scopeStr == "" {
		return nil
	}

	return strings.Split(scopeStr, " ")
}

func (ctrl *Controller) Oauth2UserinfoGet( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2UserinfoGetRequestObject,
) (api.Oauth2UserinfoGetResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	jwtToken, ok := ctrl.jwtGetter.FromContext(ctx)
	if !ok {
		return oauth2Error("invalid_token", "Invalid access token"), nil
	}

	userID, err := ctrl.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		return oauth2Error("invalid_token", "Invalid access token"), nil //nolint:nilerr
	}

	resp, oauthErr := ctrl.oauth2.GetUserinfo(ctx, userID, scopesFromJWT(jwtToken), logger)
	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2UserinfoGet200JSONResponse(*resp), nil
}

func (ctrl *Controller) Oauth2UserinfoPost( //nolint:ireturn
	ctx context.Context,
	_ api.Oauth2UserinfoPostRequestObject,
) (api.Oauth2UserinfoPostResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if !ctrl.config.OAuth2ProviderEnabled {
		return oauth2Error("server_error", "OAuth2 provider is disabled"), nil
	}

	jwtToken, ok := ctrl.jwtGetter.FromContext(ctx)
	if !ok {
		return oauth2Error("invalid_token", "Invalid access token"), nil
	}

	userID, err := ctrl.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		return oauth2Error("invalid_token", "Invalid access token"), nil //nolint:nilerr
	}

	resp, oauthErr := ctrl.oauth2.GetUserinfo(ctx, userID, scopesFromJWT(jwtToken), logger)
	if oauthErr != nil {
		return oauth2Error(oauthErr.Err, oauthErr.Description), nil
	}

	return api.Oauth2UserinfoPost200JSONResponse(*resp), nil
}
