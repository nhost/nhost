package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (ctrl *Controller) getNewSession(
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) (*api.Session, error) {
	userRoles, err := ctrl.db.GetUserRoles(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("error getting roles by user id: %w", err)
	}
	allowedRoles := make([]string, len(userRoles))
	for i, role := range userRoles {
		allowedRoles[i] = role.Role
	}

	refreshToken := uuid.New()
	expiresAt := time.Now().Add(time.Duration(ctrl.config.RefreshTokenExpiresIn) * time.Second)
	if _, err := ctrl.db.InsertRefreshtoken(ctx, sql.InsertRefreshtokenParams{
		UserID:           user.ID,
		RefreshTokenHash: sql.Text(hashRefreshToken([]byte(refreshToken.String()))),
		ExpiresAt:        sql.TimestampTz(expiresAt),
	}); err != nil {
		return nil, fmt.Errorf("error inserting refresh token: %w", err)
	}

	if _, err := ctrl.db.UpdateUserLastSeen(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("error updating last seen: %w", err)
	}

	accessToken, expiresIn, err := ctrl.jwtGetter.GetToken(
		ctx, user.ID, allowedRoles, user.DefaultRole, logger,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting jwt: %w", err)
	}

	var metadata map[string]any
	if err := json.Unmarshal(user.Metadata, &metadata); err != nil {
		return nil, fmt.Errorf("error unmarshalling user metadata: %w", err)
	}

	return &api.Session{
		AccessToken:          accessToken,
		AccessTokenExpiresIn: expiresIn,
		RefreshToken:         refreshToken.String(),
		User: &api.User{
			AvatarUrl:           user.AvatarUrl,
			CreatedAt:           user.CreatedAt.Time,
			DefaultRole:         user.DefaultRole,
			DisplayName:         user.DisplayName,
			Email:               openapi_types.Email(user.Email.String),
			EmailVerified:       user.EmailVerified,
			Id:                  user.ID.String(),
			IsAnonymous:         false,
			Locale:              user.Locale,
			Metadata:            metadata,
			PhoneNumber:         user.PhoneNumber.String,
			PhoneNumberVerified: user.PhoneNumberVerified,
			Roles:               allowedRoles,
		},
	}, nil
}

func (ctrl *Controller) postSigninEmailPasswordWithTOTP( //nolint:ireturn
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) (api.PostSigninEmailPasswordResponseObject, error) {
	ticket := "mfaTotp:" + uuid.NewString()
	expiresAt := time.Now().Add(5 * time.Minute) //nolint:gomnd

	if _, err := ctrl.db.UpdateUserTicket(ctx, sql.UpdateUserTicketParams{
		ID:              userID,
		Ticket:          sql.Text(ticket),
		TicketExpiresAt: sql.TimestampTz(expiresAt),
	}); err != nil {
		logger.Error("error updating user ticket", logError(err))
		return nil, fmt.Errorf("error updating user ticket: %w", err)
	}

	return api.PostSigninEmailPassword200JSONResponse{
		Mfa: &api.MFAChallengePayload{
			Ticket: ticket,
		},
		Session: nil,
	}, nil
}

func (ctrl *Controller) PostSigninEmailPassword( //nolint:ireturn
	ctx context.Context, request api.PostSigninEmailPasswordRequestObject,
) (api.PostSigninEmailPasswordResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	user, err := ctrl.validator.ValidateUserByEmail(
		ctx, string(request.Body.Email), logger.WithGroup("validator"),
	)
	if err != nil {
		return ctrl.respondWithError(err), nil
	}

	if !verifyHashPassword(request.Body.Password, user.PasswordHash.String) {
		logger.Warn("password doesn't match")
		return ctrl.sendError(api.InvalidEmailPassword), nil
	}

	if ctrl.config.RequireEmailVerification && !user.EmailVerified {
		logger.Warn("user email is not verified")
		return ctrl.sendError(api.UnverifiedUser), nil
	}

	if user.ActiveMfaType.String == "totp" {
		return ctrl.postSigninEmailPasswordWithTOTP(ctx, user.ID, logger)
	}

	session, err := ctrl.getNewSession(ctx, user, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(api.InternalServerError), nil
	}

	return api.PostSigninEmailPassword200JSONResponse{
		Session: session,
		Mfa:     nil,
	}, nil
}
