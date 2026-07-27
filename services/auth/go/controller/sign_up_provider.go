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

func (ctrl *Controller) SignUpProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignUpProviderRequestObject,
) (api.SignUpProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", req.Provider))

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

	redirectTo, apiErr := ctrl.getSignupProviderValidateRequest(ctx, req, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	provider := ctrl.Providers.Get(req.Provider)
	if provider == nil {
		logger.ErrorContext(ctx, "provider not enabled")
		return ctrl.sendRedirectError(redirectTo, ErrDisabledEndpoint), nil
	}

	rawNonce, nonceOpts, err := nonceForProvider(provider)
	if err != nil {
		logger.ErrorContext(ctx, "error generating nonce", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	stateData := providers.State{
		Connect: nil, // no connect for signup
		Options: &api.SignUpOptions{
			AllowedRoles: req.Params.AllowedRoles,
			DefaultRole:  req.Params.DefaultRole,
			DisplayName:  req.Params.DisplayName,
			Locale:       req.Params.Locale,
			Metadata:     req.Params.Metadata,
			RedirectTo:   new(redirectTo.String()),
		},
		State:         req.Params.State,
		Flow:          providers.FlowSignup,
		CodeChallenge: req.Params.CodeChallenge,
		Nonce:         rawNonce,
	}

	state, err := ctrl.wf.jwtGetter.SignTokenWithClaims(
		stateData.Encode(),
		time.Now().Add(time.Minute),
	)
	if err != nil {
		logger.ErrorContext(ctx, "error signing state token", logError(err))
		return ctrl.sendRedirectError(redirectTo, ErrInternalServerError), nil
	}

	providerURL, apiErr := ctrl.providerAuthCodeURL(
		ctx, provider, state, req.Params.ProviderSpecificParams, logger, nonceOpts...,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignUpProvider302Response{
		Headers: api.SignUpProvider302ResponseHeaders{
			Location: providerURL,
		},
	}, nil
}
