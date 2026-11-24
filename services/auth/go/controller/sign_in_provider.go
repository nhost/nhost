package controller

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
)

func (ctrl *Controller) validateProviderStart(
	ctx context.Context,
	redirectToParam, codeChallenge *string,
	logger *slog.Logger,
) (*url.URL, *APIError) {
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		ctx,
		&api.OptionsRedirectTo{
			RedirectTo: redirectToParam,
		},
		logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	redirectTo, err := url.Parse(*options.RedirectTo)
	if err != nil {
		logger.ErrorContext(ctx, "error parsing redirect URL",
			slog.String("redirectTo", *options.RedirectTo), logError(err))

		return nil, ErrInvalidRequest
	}

	if cc := deptr(codeChallenge); cc != "" {
		if err := pkce.ValidateCodeChallengeFormat(cc); err != nil {
			logger.WarnContext(ctx, "invalid code challenge format", logError(err))
			return nil, ErrInvalidRequest
		}
	}

	return redirectTo, nil
}

func (ctrl *Controller) SignInProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderRequestObject,
) (api.SignInProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	redirectTo, apiErr := ctrl.validateProviderStart(
		ctx, req.Params.RedirectTo, req.Params.CodeChallenge, logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	location, apiErr := ctrl.startProvider(
		ctx,
		ctrl.Providers.Get(string(req.Provider)),
		providers.State{
			Connect: req.Params.Connect,
			Options: &api.SignUpOptions{
				AllowedRoles: req.Params.AllowedRoles,
				DefaultRole:  req.Params.DefaultRole,
				DisplayName:  req.Params.DisplayName,
				Locale:       req.Params.Locale,
				Metadata:     req.Params.Metadata,
				RedirectTo:   new(redirectTo.String()),
			},
			State:         req.Params.State,
			Flow:          providers.FlowSignin,
			CodeChallenge: req.Params.CodeChallenge,
		},
		req.Params.ProviderSpecificParams,
		req.Params.UpstreamParams,
		logger,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignInProvider302Response{
		Headers: api.SignInProvider302ResponseHeaders{
			Location: location,
		},
	}, nil
}

func (ctrl *Controller) startProvider(
	ctx context.Context,
	provider *providers.Provider,
	state providers.State,
	providerSpecificParams *api.ProviderSpecificParams,
	upstreamParams *api.UpstreamAuthParams,
	logger *slog.Logger,
) (string, *APIError) {
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return "", ErrDisabledEndpoint
	}

	signedState, err := ctrl.wf.jwtGetter.SignTokenWithClaims(
		state.Encode(), time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return "", ErrInternalServerError
	}

	return ctrl.getProviderAuthCodeURL(
		ctx,
		provider,
		signedState,
		providerSpecificParams,
		upstreamParams,
		logger,
	)
}

// getProviderAuthCodeURL builds the provider authorization URL, forwarding
// upstreamParams to OAuth2 providers.
func (ctrl *Controller) getProviderAuthCodeURL(
	ctx context.Context,
	provider *providers.Provider,
	state string,
	providerSpecificParams *api.ProviderSpecificParams,
	upstreamParams *api.UpstreamAuthParams,
	logger *slog.Logger,
) (string, *APIError) {
	if provider.IsOauth1() {
		url, err := provider.Oauth1().AuthCodeURL(ctx, state)
		if err != nil {
			logger.ErrorContext(
				ctx,
				"error getting auth code URL for Oauth1 provider",
				logError(err),
			)

			return "", ErrInternalServerError
		}

		return url, nil
	}

	opts, err := providers.UpstreamParamsToOpts(upstreamParams)
	if err != nil {
		logger.WarnContext(ctx, "invalid upstream params", logError(err))
		return "", ErrInvalidRequest
	}

	return provider.Oauth2().AuthCodeURL(state, providerSpecificParams, opts...), nil
}
