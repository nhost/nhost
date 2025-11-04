package controller

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) postSignupWebauthnValidateRequest(
	ctx context.Context,
	request api.SignUpWebauthnRequestObject,
	logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return nil, ErrDisabledEndpoint
	}

	if ctrl.config.DisableSignup {
		logger.ErrorContext(ctx, "signup is disabled")
		return nil, ErrSignupDisabled
	}

	options, apiErr := ctrl.wf.ValidateSignUpOptions(
		ctx, request.Body.Options, string(request.Body.Email), logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	if apiErr := ctrl.wf.ValidateSignupEmail(ctx, request.Body.Email, logger); apiErr != nil {
		return nil, apiErr
	}

	return options, nil
}

func (ctrl *Controller) SignUpWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.SignUpWebauthnRequestObject,
) (api.SignUpWebauthnResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	options, apiErr := ctrl.postSignupWebauthnValidateRequest(ctx, request, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	user := WebauthnUser{
		ID:           uuid.New(),
		Name:         deptr(options.DisplayName),
		Email:        string(request.Body.Email),
		Credentials:  nil,
		Discoverable: false,
	}

	creation, apiErr := ctrl.Webauthn.BeginRegistration(ctx, user, options, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.SignUpWebauthn200JSONResponse(creation.Response), nil
}
