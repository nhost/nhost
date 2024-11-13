package controller

import (
	"context"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) PostLinkIdtoken( //nolint:ireturn
	ctx context.Context, req api.PostLinkIdtokenRequestObject,
) (api.PostLinkIdtokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	profile, apiErr := ctrl.wf.GetOIDCProfileFromIDToken(
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
		logger.Error(
			"jwt token not found in context, this should not be possilble due to middleware",
		)
		return ctrl.sendError(ErrInternalServerError), nil
	}

	userID, err := ctrl.wf.jwtGetter.GetUserID(jwtToken)
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	// we do this to check the user is valid
	if _, apiError := ctrl.wf.GetUser(ctx, userID, logger); apiError != nil {
		logger.Error("error getting user", logError(apiError))
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

	return api.PostLinkIdtoken200JSONResponse(api.OK), nil
}
