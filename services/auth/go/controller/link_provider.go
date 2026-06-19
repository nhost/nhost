package controller

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
)

// LinkProvider starts the authenticated account-linking flow. The elevated
// bearer is enforced by the BearerAuthElevated security scheme, so the user's
// identity comes from the Authorization header and is never placed in the URL.
// We record that identity in a short-lived, single-use cookie and return the
// provider authorization URL for the client to redirect to. The callback links
// the provider to whoever the cookie identifies, so the link always commits to
// the user who actually completed the provider login.
func (ctrl *Controller) LinkProvider( //nolint:ireturn
	ctx context.Context,
	req api.LinkProviderRequestObject,
) (api.LinkProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(string(req.Provider))
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		ctx, &api.OptionsRedirectTo{RedirectTo: req.Body.RedirectTo}, logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	nonce, err := pkce.GenerateCode()
	if err != nil {
		logger.ErrorContext(ctx, "error generating nonce", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	if err := ctrl.setLinkConnectCookie(ctx, linkConnectData{
		UserID:   user.ID,
		Provider: string(req.Provider),
		Nonce:    nonce,
	}); err != nil {
		logger.ErrorContext(ctx, "error setting link cookie", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	state, err := ctrl.signConnectState(options.RedirectTo, req.Body.State, nonce)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	url, err := connectAuthCodeURL(ctx, provider, state, req.Body.ProviderSpecificParams)
	if err != nil {
		logger.ErrorContext(ctx, "error building authorize url", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.LinkProvider200JSONResponse(api.LinkProviderResponse{Url: url}), nil
}

// signConnectState builds the signed OAuth state for the connect flow. Unlike
// the legacy flow it carries no access token; the user's identity lives in the
// cookie. Nonce binds the cookie to this state for the CSRF check at callback.
func (ctrl *Controller) signConnectState(
	redirectTo *string, clientState *string, nonce string,
) (string, error) {
	state, err := ctrl.jwtGetter.SignTokenWithClaims(
		jwt.MapClaims{
			"options": api.SignUpOptions{ //nolint:exhaustruct
				RedirectTo: redirectTo,
			},
			"state": clientState,
			"flow":  providers.FlowConnect,
			"nonce": nonce,
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		return "", fmt.Errorf("error signing connect state: %w", err)
	}

	return state, nil
}

func connectAuthCodeURL(
	ctx context.Context,
	provider *providers.Provider,
	state string,
	params *api.ProviderSpecificParams,
) (string, error) {
	if provider.IsOauth1() {
		url, err := provider.Oauth1().AuthCodeURL(ctx, state)
		if err != nil {
			return "", fmt.Errorf("error getting oauth1 auth code url: %w", err)
		}

		return url, nil
	}

	return provider.Oauth2().AuthCodeURL(state, params), nil
}
