package controller

import (
	"context"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) SignInPAT( //nolint:ireturn
	ctx context.Context,
	request api.SignInPATRequestObject,
) (api.SignInPATResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	user, apiErr := ctrl.wf.GetUserByRefreshTokenHash(
		ctx,
		request.Body.PersonalAccessToken,
		sql.RefreshTokenTypePAT,
		logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.SignInPAT200JSONResponse{
		Session: session,
	}, nil
}
