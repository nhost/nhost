package controller

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (ctrl *Controller) GetElevationMethods( //nolint:ireturn
	ctx context.Context,
	_ api.GetElevationMethodsRequestObject,
) (api.GetElevationMethodsResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	userID, apiErr := ctrl.wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	jwtToken, ok := ctrl.wf.jwtGetter.FromContext(ctx)
	if !ok {
		logger.ErrorContext(ctx, "jwt token missing after user id was read from context")
		return ctrl.sendError(ErrInternalServerError), nil
	}

	methods, err := ctrl.wf.jwtGetter.availableElevationMethods(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "user not found")
		return ctrl.sendError(ErrInvalidEmailPassword), nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "failed to list elevation methods", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	// The field is required by the schema, so a nil slice must still marshal
	// as [] rather than null.
	if methods == nil {
		methods = []api.ElevationMethod{}
	}

	return api.GetElevationMethods200JSONResponse{
		ElevationRequired: ctrl.wf.jwtGetter.elevationRequired(methods),
		Methods:           methods,
		SessionElevated:   ctrl.wf.jwtGetter.hasElevatedClaim(jwtToken),
	}, nil
}
