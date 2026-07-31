package controller

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	"github.com/golang-jwt/jwt/v5"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/providers"
)

func (ctrl *Controller) getSigninProviderValidateRequest(
	ctx context.Context,
	req api.SignInProviderRequestObject,
	logger *slog.Logger,
) (*url.URL, *APIError) {
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
		ctx,
		&api.OptionsRedirectTo{
			RedirectTo: req.Params.RedirectTo,
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

	if cc := deptr(req.Params.CodeChallenge); cc != "" {
		if err := pkce.ValidateCodeChallengeFormat(cc); err != nil {
			logger.WarnContext(ctx, "invalid code challenge format", logError(err))
			return nil, ErrInvalidRequest
		}
	}

	return redirectTo, nil
}

// providerAuthCodeURL builds the provider's authorization URL for either
// protocol. Both branches can fail: Oauth1 fetches a request token over
// HTTP, and Oauth2 providers may discover their endpoints lazily.
func (ctrl *Controller) providerAuthCodeURL(
	ctx context.Context,
	provider *providers.Provider,
	state string,
	params *api.ProviderSpecificParams,
	logger *slog.Logger,
) (string, *APIError) {
	var (
		url string
		err error
	)

	switch {
	case provider.IsOauth1():
		url, err = provider.Oauth1().AuthCodeURL(ctx, state)
	default:
		url, err = provider.Oauth2().AuthCodeURL(ctx, state, params)
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting auth code URL from provider",
			slog.Bool("oauth1", provider.IsOauth1()), logError(err))

		return "", ErrInternalServerError
	}

	return url, nil
}

func (ctrl *Controller) SignInProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderRequestObject,
) (api.SignInProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", req.Provider))

	redirectTo, apiErr := ctrl.getSigninProviderValidateRequest(ctx, req, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(req.Provider)
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return ctrl.sendRedirectError(redirectTo, ErrDisabledEndpoint), nil
	}

	state, err := ctrl.wf.jwtGetter.SignTokenWithClaims(
		jwt.MapClaims{
			"connect": req.Params.Connect,
			"options": api.SignUpOptions{
				AllowedRoles: req.Params.AllowedRoles,
				DefaultRole:  req.Params.DefaultRole,
				DisplayName:  req.Params.DisplayName,
				Locale:       req.Params.Locale,
				Metadata:     req.Params.Metadata,
				RedirectTo:   new(redirectTo.String()),
			},
			"state":         req.Params.State,
			"flow":          providers.FlowSignin,
			"codeChallenge": req.Params.CodeChallenge,
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	url, apiErr := ctrl.providerAuthCodeURL(
		ctx, provider, state, req.Params.ProviderSpecificParams, logger,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignInProvider302Response{
		Headers: api.SignInProvider302ResponseHeaders{
			Location: url,
		},
	}, nil
}
