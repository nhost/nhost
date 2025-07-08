package controller

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
)

func (ctrl *Controller) postSigninEmailPasswordWithTOTP( //nolint:ireturn
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) (api.SignInEmailPasswordResponseObject, error) {
	ticket := "mfaTotp:" + uuid.NewString()
	expiresAt := time.Now().Add(In5Minutes)

	if apiErr := ctrl.wf.SetTicket(ctx, userID, ticket, expiresAt, logger); apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInEmailPassword200JSONResponse{
		Mfa: &api.MFAChallengePayload{
			Ticket: ticket,
		},
		Session: nil,
	}, nil
}

func (ctrl *Controller) SignInEmailPassword( //nolint:ireturn
	ctx context.Context, request api.SignInEmailPasswordRequestObject,
) (api.SignInEmailPasswordResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx).
		With(slog.String("email", string(request.Body.Email)))

	user, apiErr := ctrl.wf.GetUserByEmail(ctx, string(request.Body.Email), logger)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	if !verifyHashPassword(request.Body.Password, user.PasswordHash.String) {
		logger.Warn("password doesn't match")
		return ctrl.sendError(ErrInvalidEmailPassword), nil
	}

	if user.ActiveMfaType.String == string(api.Totp) {
		return ctrl.postSigninEmailPasswordWithTOTP(ctx, user.ID, logger)
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.SignInEmailPassword200JSONResponse{
		Session: session,
		Mfa:     nil,
	}, nil
}
