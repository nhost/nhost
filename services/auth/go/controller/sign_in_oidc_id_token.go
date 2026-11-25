package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) SignInOidcIdToken( //nolint:ireturn,revive
	ctx context.Context, req api.SignInOidcIdTokenRequestObject,
) (api.SignInOidcIdTokenResponseObject, error) {
	session, apiErr := ctrl.oidcIDTokenSession(ctx, req.Provider, req.Body, false)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignInOidcIdToken200JSONResponse{Session: session}, nil
}

func (ctrl *Controller) SignUpOidcIdToken( //nolint:ireturn,revive
	ctx context.Context, req api.SignUpOidcIdTokenRequestObject,
) (api.SignUpOidcIdTokenResponseObject, error) {
	session, apiErr := ctrl.oidcIDTokenSession(
		ctx, req.Provider, (*api.SignInOidcIdTokenRequest)(req.Body), true,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignUpOidcIdToken200JSONResponse{Session: session}, nil
}

func (ctrl *Controller) oidcIDTokenSession(
	ctx context.Context, slug string, body *api.SignInOidcIdTokenRequest, signup bool,
) (*api.Session, *APIError) {
	ctx = oidcRequestContext(ctx)
	logger := oapimw.LoggerFromContext(ctx).With(slog.String("provider", slug))

	p := ctrl.oidcProviders.Get(slug)
	if p == nil {
		return nil, ErrDisabledEndpoint
	}

	if signup && ctrl.config.DisableSignup {
		return nil, ErrSignupDisabled
	}

	if body == nil {
		return nil, ErrInvalidRequest
	}

	profile, err := p.VerifyNative(ctx, body.IdToken, deptr(body.Nonce))
	if err != nil {
		logger.WarnContext(ctx, "failed to verify native OIDC ID token")
		return nil, ErrInvalidRequest
	}

	profile.ProviderUserID = p.IdentityKey(profile.ProviderUserID)

	if signup {
		return ctrl.providerSignUpFlow(ctx, profile, customIdentity(p), body.Options, logger)
	}

	return ctrl.providerSignInFlow(ctx, profile, customIdentity(p), body.Options, logger)
}
