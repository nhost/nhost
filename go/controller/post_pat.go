package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) getUserFromJWTInContext(
	ctx context.Context,
	logger *slog.Logger,
) (sql.AuthUser, *APIError) {
	jwtToken, ok := ctrl.jwtGetter.FromContext(ctx)
	if !ok {
		logger.Error(
			"jwt token not found in context, this should not be possilble due to middleware",
		)
		return sql.AuthUser{}, &APIError{api.InternalServerError} //nolint:exhaustruct
	}

	sub, err := jwtToken.Claims.GetSubject()
	if err != nil {
		logger.Error("error getting user id from jwt token", logError(err))
		return sql.AuthUser{}, &APIError{api.InvalidRequest} //nolint:exhaustruct
	}
	logger = logger.With(slog.String("user_id", sub))

	userID, err := uuid.Parse(sub)
	if err != nil {
		logger.Error("error parsing user id from jwt token's subject", logError(err))
		return sql.AuthUser{}, &APIError{api.InvalidRequest} //nolint:exhaustruct
	}

	user, err := ctrl.db.GetUser(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return sql.AuthUser{}, &APIError{api.UserNotFound} //nolint:exhaustruct
	}
	if err != nil {
		logger.Error("error getting user by id", logError(err))
		return sql.AuthUser{}, &APIError{api.InternalServerError} //nolint:exhaustruct
	}

	if apiErr := ctrl.validator.ValidateUser(user, logger); apiErr != nil {
		return sql.AuthUser{}, apiErr //nolint:exhaustruct
	}

	return user, nil
}

func (ctrl *Controller) PostPat( //nolint:ireturn
	ctx context.Context, request api.PostPatRequestObject,
) (api.PostPatResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)
	user, apiErr := ctrl.getUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	var metadata []byte
	var err error
	if request.Body.Metadata != nil {
		metadata, err = json.Marshal(*request.Body.Metadata)
		if err != nil {
			logger.Error("error marshalling metadata", logError(err))
			return ctrl.sendError(api.InternalServerError), nil
		}
	}

	pat := uuid.New()
	refreshToken, err := ctrl.db.InsertRefreshtoken(ctx, sql.InsertRefreshtokenParams{
		UserID:           user.ID,
		RefreshTokenHash: sql.Text(hashRefreshToken([]byte(pat.String()))),
		ExpiresAt:        sql.TimestampTz(request.Body.ExpiresAt),
		Type:             sql.RefreshTokenTypePAT,
		Metadata:         metadata,
	})
	if err != nil {
		return nil, fmt.Errorf("error inserting refresh token: %w", err)
	}

	return api.PostPat200JSONResponse{
		Id:                  refreshToken.String(),
		PersonalAccessToken: pat.String(),
	}, nil
}
