package controller

import (
	"context"
	"errors"
	"math/rand/v2"

	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) RefreshToken( //nolint:ireturn
	ctx context.Context, request api.RefreshTokenRequestObject,
) (api.RefreshTokenResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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

	// no need to be cryptographically secure, performance of pseudo-random number is preferred
	if rand.IntN(100) < 1 { //nolint:gosec,mnd
		if err := ctrl.wf.db.DeleteExpiredRefreshTokens(ctx); err != nil {
			logger.ErrorContext(ctx, "error deleting expired refresh tokens", logError(err))
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
