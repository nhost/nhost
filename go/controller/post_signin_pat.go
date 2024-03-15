package controller

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) PostSigninPat( //nolint:ireturn
	ctx context.Context,
	request api.PostSigninPatRequestObject,
) (api.PostSigninPatResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	user, err := ctrl.db.GetUserByRefreshTokenHash(
		ctx,
		sql.GetUserByRefreshTokenHashParams{
			RefreshTokenHash: sql.Text(hashRefreshToken([]byte(request.Body.PersonalAccessToken))),
			Type:             sql.RefreshTokenTypePAT,
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.Error("could not find user by refresh token")
		return ctrl.sendError(api.InvalidPat), nil
	}
	if err != nil {
		logger.Error("could not get user by refresh token", logError(err))
		return ctrl.sendError(api.InternalServerError), nil
	}

	if apiErr := ctrl.validator.ValidateUser(user, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	session, err := ctrl.getNewSession(ctx, user, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(api.InternalServerError), nil
	}

	return api.PostSigninPat200JSONResponse{
		Session: session,
	}, nil
}
