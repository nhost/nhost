package controller

import (
	"context"
	"log/slog"
	"slices"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) postSigninAnonymousValidateRequest(
	req api.SignInAnonymousRequestObject, logger *slog.Logger,
) (api.SignInAnonymousRequestObject, *APIError) {
	if ctrl.config.DisableSignup {
		logger.Warn("signup disabled")
		return api.SignInAnonymousRequestObject{}, ErrSignupDisabled
	}

	if !ctrl.config.AnonymousUsersEnabled {
		logger.Warn("anonymous users disabled")
		return api.SignInAnonymousRequestObject{}, ErrAnonymousUsersDisabled
	}

	if req.Body == nil {
		req.Body = &api.SignInAnonymousJSONRequestBody{} //nolint:exhaustruct
	}

	if req.Body.Locale == nil {
		req.Body.Locale = ptr(ctrl.config.DefaultLocale)
	}
	if !slices.Contains(ctrl.config.AllowedLocales, deptr(req.Body.Locale)) {
		logger.Warn(
			"locale not allowed, using default",
			slog.String("locale", deptr(req.Body.Locale)),
		)
		req.Body.Locale = ptr(ctrl.config.DefaultLocale)
	}

	if req.Body.DisplayName == nil {
		req.Body.DisplayName = ptr("Anonymous User")
	}

	return req, nil
}

func (ctrl *Controller) SignInAnonymous( //nolint:ireturn
	ctx context.Context, req api.SignInAnonymousRequestObject,
) (api.SignInAnonymousResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	req, apiErr := ctrl.postSigninAnonymousValidateRequest(req, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, apiErr := ctrl.wf.SignupAnonymousUser(
		ctx, deptr(req.Body.Locale), deptr(req.Body.DisplayName), deptr(req.Body.Metadata), logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInAnonymous200JSONResponse{
		Session: session,
	}, nil
}
