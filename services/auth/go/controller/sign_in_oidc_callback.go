package controller

import (
	"context"
	"log/slog"
	"net/url"

	"github.com/gin-gonic/gin"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/pkce"
)

func (ctrl *Controller) SignInOidcCallback( //nolint:ireturn
	ctx context.Context, req api.SignInOidcCallbackRequestObject,
) (api.SignInOidcCallbackResponseObject, error) {
	requestCtx := oidcRequestContext(ctx)
	logger := oapimw.LoggerFromContext(requestCtx).With(slog.String("provider", req.Provider))

	p := ctrl.oidcProviders.Get(req.Provider)
	if p == nil {
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	state, apiErr := ctrl.decodeOIDCState(req.Params.State)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if state.ProviderID != p.ID() || state.Issuer != p.Issuer() || state.ClientID != p.ClientID() {
		return ctrl.sendError(ErrInvalidState), nil
	}

	deleteCookie := oidcCookie(state.Nonce, "", -1)

	verifier, apiErr := oidcCallbackVerifier(ctx, deleteCookie.Name, state.UpstreamChallenge)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	redirect, apiErr := ctrl.validateProviderStart(
		requestCtx, state.Intent.Options.RedirectTo, state.Intent.CodeChallenge, logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if state.Intent.State != nil {
		redirect = appendURLValues(redirect, map[string]string{"state": *state.Intent.State})
	}

	location, apiErr := ctrl.finishOIDC(
		requestCtx,
		p,
		req.Params,
		state,
		verifier,
		redirect,
		logger,
	)
	if apiErr != nil {
		location = ctrl.sendRedirectError(redirect, apiErr).Headers.Location
	}

	return api.SignInOidcCallback302Response{
		Headers: api.SignInOidcCallback302ResponseHeaders{
			Location:  location,
			SetCookie: new(deleteCookie.String()),
		},
	}, nil
}

func oidcCallbackVerifier(ctx context.Context, cookieName, challenge string) (string, *APIError) {
	ginCtx, ok := ctx.(*gin.Context)
	if !ok {
		return "", ErrInvalidState
	}

	query := ginCtx.Request.URL.Query()
	for _, name := range []string{"state", "code", "iss", "error"} {
		if len(query[name]) > 1 {
			return "", ErrInvalidState
		}
	}

	cookie, err := ginCtx.Request.Cookie(cookieName)
	if err != nil || pkce.ValidateS256(challenge, cookie.Value) != nil {
		return "", ErrInvalidState
	}

	return cookie.Value, nil
}

func (ctrl *Controller) finishOIDC(
	ctx context.Context,
	provider *oidc.CustomProvider,
	params api.SignInOidcCallbackParams,
	state *oidcBrowserState,
	verifier string,
	redirect *url.URL,
	logger *slog.Logger,
) (string, *APIError) {
	if params.Error != nil {
		return "", ErrOauthProviderError
	}

	if code := deptr(params.Code); code == "" {
		return "", ErrInvalidRequest
	}

	profile, err := provider.Exchange(
		ctx, deptr(params.Code), verifier, state.Nonce, params.Iss,
	)
	if err != nil {
		logger.WarnContext(ctx, "failed to verify OIDC authorization response")
		return "", ErrOauthTokenExchangeFailed
	}

	profile.ProviderUserID = provider.IdentityKey(profile.ProviderUserID)

	location, apiErr := ctrl.signinProviderProviderCallbackSession(
		ctx, provider.ID(), profile, &state.Intent, redirect, logger,
	)
	if apiErr != nil {
		return "", apiErr
	}

	return location.String(), nil
}
