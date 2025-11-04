package controller

import (
	"context"

	"github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) LinkIdToken( //nolint:ireturn,revive
	ctx context.Context, req api.LinkIdTokenRequestObject,
) (api.LinkIdTokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	profile, apiErr := ctrl.wf.GetOIDCProfileFromIDToken(
		ctx,
		req.Body.Provider,
		req.Body.IdToken,
		req.Body.Nonce,
		logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.ErrorContext(ctx,
			"jwt token not found in context, this should not be possilble due to middleware",
		)

		return ctrl.sendError(ErrInternalServerError), nil
	}

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.ErrorContext(ctx, "error getting user id from jwt token", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	// we do this to check the user is valid
	if _, apiError := ctrl.wf.GetUser(ctx, userID, logger); apiError != nil {
		logger.ErrorContext(ctx, "error getting user", logError(apiError))
		return ctrl.respondWithError(apiError), nil
	}

	if _, apiErr := ctrl.wf.InsertUserProvider(
		ctx,
		userID,
		string(req.Body.Provider),
		profile.ProviderUserID,
		logger,
	); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.LinkIdToken200JSONResponse(api.OK), nil
}
