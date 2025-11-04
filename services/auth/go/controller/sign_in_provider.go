package controller

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	"github.com/golang-jwt/jwt/v5"
	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
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

	return redirectTo, nil
}

func (ctrl *Controller) SignInProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignInProviderRequestObject,
) (api.SignInProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	redirectTo, apiErr := ctrl.getSigninProviderValidateRequest(ctx, req, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(string(req.Provider))
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
				RedirectTo:   req.Params.RedirectTo,
			},
			"state": req.Params.State,
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	var url string

	switch {
	case provider.IsOauth1():
		url, err = provider.Oauth1().AuthCodeURL(ctx, state)
		if err != nil {
			logger.ErrorContext(
				ctx,
				"error getting auth code URL for Oauth1 provider",
				logError(err),
			)

			return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
		}
	default:
		url = provider.Oauth2().AuthCodeURL(
			state,
		)
	}

	return api.SignInProvider302Response{
		Headers: api.SignInProvider302ResponseHeaders{
			Location: url,
		},
	}, nil
}
