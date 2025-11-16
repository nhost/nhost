package controller

import (
	"context"

	"github.com/google/uuid"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) CreatePAT( //nolint:ireturn
	ctx context.Context, request api.CreatePATRequestObject,
) (api.CreatePATResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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
