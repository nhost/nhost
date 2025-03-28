package controller

import (
	"context"
	"log/slog"
	"slices"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) postSigninAnonymousValidateRequest(
	req api.PostSigninAnonymousRequestObject, logger *slog.Logger,
) (api.PostSigninAnonymousRequestObject, *APIError) {
	if ctrl.config.DisableSignup {
		logger.Warn("signup disabled")
		return api.PostSigninAnonymousRequestObject{}, ErrSignupDisabled
	}

	if !ctrl.config.AnonymousUsersEnabled {
		logger.Warn("anonymous users disabled")
		return api.PostSigninAnonymousRequestObject{}, ErrAnonymousUsersDisabled
	}

	if req.Body == nil {
		req.Body = &api.PostSigninAnonymousJSONRequestBody{} //nolint:exhaustruct
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

func (ctrl *Controller) PostSigninAnonymous( //nolint:ireturn
	ctx context.Context, req api.PostSigninAnonymousRequestObject,
) (api.PostSigninAnonymousResponseObject, error) {
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

	return api.PostSigninAnonymous200JSONResponse{
		Session: session,
	}, nil
}
