package controller

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/pkce"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) TokenExchange( //nolint:ireturn
	ctx context.Context,
	request api.TokenExchangeRequestObject,
) (api.TokenExchangeResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	codeHash := pkce.HashCode(request.Body.Code)
	codeChallenge := pkce.ComputeS256Challenge(request.Body.CodeVerifier)

	authCode, err := ctrl.wf.db.ConsumePKCEAuthorizationCode(
		ctx,
		sql.ConsumePKCEAuthorizationCodeParams{
			CodeHash:      codeHash,
			CodeChallenge: codeChallenge,
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "invalid or expired authorization code")
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	if err != nil {
		logger.ErrorContext(ctx, "error consuming authorization code", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	user, apiErr := ctrl.wf.GetUser(ctx, authCode.UserID, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	session, sessionErr := ctrl.wf.NewSession(ctx, user, nil, logger)
	if sessionErr != nil {
		logger.ErrorContext(ctx, "error creating session", logError(sessionErr))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.TokenExchange200JSONResponse{Session: session}, nil
}
