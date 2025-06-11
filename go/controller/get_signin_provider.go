package controller

import (
	"context"
	"log/slog"
	"net/url"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) getSigninProviderValidateRequest(
	req api.GetSigninProviderProviderRequestObject,
	logger *slog.Logger,
) (*url.URL, *APIError) {
	options, apiErr := ctrl.wf.ValidateOptionsRedirectTo(
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
		logger.Error("error parsing redirect URL",
			slog.String("redirectTo", *options.RedirectTo), logError(err))
		return nil, ErrInvalidRequest
	}

	return redirectTo, nil
}

func (ctrl *Controller) GetSigninProviderProvider( //nolint:ireturn
	ctx context.Context,
	req api.GetSigninProviderProviderRequestObject,
) (api.GetSigninProviderProviderResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	redirectTo, apiErr := ctrl.getSigninProviderValidateRequest(req, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(string(req.Provider))
	if provider == nil {
		logger.Error("provider not enabled")
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
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.Error("error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	var url string
	switch {
	case provider.IsOauth1():
		url, err = provider.Oauth1().AuthCodeURL(ctx, state)
		if err != nil {
			logger.Error("error getting auth code URL for Oauth1 provider", logError(err))
			return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
		}
	default:
		url = provider.Oauth2().AuthCodeURL(
			state,
		)
	}

	return api.GetSigninProviderProvider302Response{
		Headers: api.GetSigninProviderProvider302ResponseHeaders{
			Location: url,
		},
	}, nil
}
