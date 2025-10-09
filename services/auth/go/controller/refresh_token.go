package controller

import (
	"context"
	"errors"

	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) RefreshToken( //nolint:ireturn
	ctx context.Context, request api.RefreshTokenRequestObject,
) (api.RefreshTokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	user, apiErr := ctrl.wf.GetUserByRefreshTokenHash(
		ctx,
		request.Body.RefreshToken,
		sql.RefreshTokenTypeRegular,
		logger,
	)

	switch {
	case errors.Is(apiErr, ErrForbiddenAnonymous):
	case errors.Is(apiErr, ErrInvalidEmailPassword):
	default:
		if apiErr != nil {
			return ctrl.respondWithError(apiErr), nil
		}
	}

	session, err := ctrl.wf.UpdateSession(ctx, user, request.Body.RefreshToken, logger)
	switch {
	case errors.Is(err, ErrInvalidRefreshToken):
		logger.ErrorContext(ctx, "invalid refresh token, token already used", logError(err))
		return ctrl.sendError(ErrInvalidRefreshToken), nil
	case err != nil:
		logger.ErrorContext(ctx, "error updating session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.RefreshToken200JSONResponse(*session), nil
}
