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

func (ctrl *Controller) getSignupProviderValidateRequest(
	ctx context.Context,
	req api.SignUpProviderRequestObject,
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

func (ctrl *Controller) SignUpProvider( //nolint:ireturn,funlen
	ctx context.Context,
	req api.SignUpProviderRequestObject,
) (api.SignUpProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

	redirectTo, apiErr := ctrl.getSignupProviderValidateRequest(ctx, req, logger)
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
			"connect": nil, // no connect for signup
			"options": api.SignUpOptions{
				AllowedRoles: req.Params.AllowedRoles,
				DefaultRole:  req.Params.DefaultRole,
				DisplayName:  req.Params.DisplayName,
				Locale:       req.Params.Locale,
				Metadata:     req.Params.Metadata,
				RedirectTo:   new(redirectTo.String()),
			},
			"state":         req.Params.State,
			"flow":          providers.FlowSignup,
			"codeChallenge": req.Params.CodeChallenge,
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	var providerURL string

	switch {
	case provider.IsOauth1():
		providerURL, err = provider.Oauth1().AuthCodeURL(ctx, state)
		if err != nil {
			logger.ErrorContext(
				ctx,
				"error getting auth code URL for Oauth1 provider",
				logError(err),
			)

			return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
		}
	default:
		providerURL = provider.Oauth2().AuthCodeURL(
			state,
			req.Params.ProviderSpecificParams,
		)
	}

	return api.SignUpProvider302Response{
		Headers: api.SignUpProvider302ResponseHeaders{
			Location: providerURL,
		},
	}, nil
}
