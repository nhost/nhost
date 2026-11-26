package controller

import (
	"context"
	"log/slog"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/providers"
)

func (ctrl *Controller) SignUpProvider( //nolint:ireturn
	ctx context.Context,
	req api.SignUpProviderRequestObject,
) (api.SignUpProviderResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("provider", string(req.Provider)))

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

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
			Connect: nil,
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
		},
		req.Params.ProviderSpecificParams,
		req.Params.UpstreamParams,
		logger,
	)
	if apiErr != nil {
		return ctrl.sendRedirectError(redirectTo, apiErr), nil
	}

	return api.SignUpProvider302Response{
		Headers: api.SignUpProvider302ResponseHeaders{
			Location: location,
		},
	}, nil
}
