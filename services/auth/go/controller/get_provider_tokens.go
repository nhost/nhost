package controller

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) GetProviderTokens( //nolint:ireturn
	ctx context.Context,
	req api.GetProviderTokensRequestObject,
) (api.GetProviderTokensResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	logger = logger.With("provider", req.Provider)

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	sessionEnc, err := ctrl.wf.db.GetProviderSession(
		ctx, sql.GetProviderSessionParams{
			UserID:     sql.UUID(user.ID),
			ProviderID: sql.Text(req.Provider),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.InfoContext(ctx, "no provider session found")

		return api.GetProviderTokens200JSONResponse{
			AccessToken:  "",
			ExpiresIn:    0,
			RefreshToken: nil,
		}, nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "failed to get provider session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	b, err := ctrl.encrypter.Decrypt([]byte(sessionEnc))
	if err != nil {
		logger.ErrorContext(ctx, "failed to decrypt provider session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	var session api.ProviderSession
	if err := json.Unmarshal(b, &session); err != nil {
		logger.ErrorContext(ctx, "failed to unmarshal provider session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.GetProviderTokens200JSONResponse(session), nil
}
