package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"golang.org/x/oauth2"
)

func (ctrl *Controller) RefreshProviderToken( //nolint:ireturn
	ctx context.Context, req api.RefreshProviderTokenRequestObject,
) (api.RefreshProviderTokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	logger = logger.With("provider", req.Provider)

	provider := ctrl.Providers.Get(string(req.Provider))
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	token, err := provider.Oauth2().Exchange(
		ctx,
		"",
		oauth2.SetAuthURLParam("grant_type", "refresh_token"),
		oauth2.SetAuthURLParam("refresh_token", req.Body.RefreshToken),
	)
	if err != nil {
		logger.ErrorContext(ctx, "failed to exchange code for token", "error", err)
		return ctrl.sendError(ErrOauthProviderError), nil
	}

	return api.RefreshProviderToken200JSONResponse(tokenToProviderSession(token)), nil
}
