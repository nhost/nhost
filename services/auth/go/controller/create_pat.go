package controller

import (
	"context"

	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) CreatePAT( //nolint:ireturn
	ctx context.Context, request api.CreatePATRequestObject,
) (api.CreatePATResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	pat := uuid.New()

	refreshTokenID, apiErr := ctrl.wf.InsertRefreshtoken(
		ctx,
		user.ID,
		pat.String(),
		request.Body.ExpiresAt,
		sql.RefreshTokenTypePAT,
		deptr(request.Body.Metadata),
		logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.CreatePAT200JSONResponse{
		Id:                  refreshTokenID.String(),
		PersonalAccessToken: pat.String(),
	}, nil
}
