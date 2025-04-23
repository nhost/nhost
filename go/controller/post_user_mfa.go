package controller

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) postUserMfaDeactivate( //nolint:ireturn
	ctx context.Context,
	req api.PostUserMfaRequestObject,
	user sql.AuthUser,
	logger *slog.Logger,
) api.PostUserMfaResponseObject {
	logger.Info("deactivating mfa")

	if user.ActiveMfaType.String != string(api.Totp) {
		logger.Warn("user does not have totp mfa enabled")
		return ctrl.sendError(ErrDisabledMfaTotp)
	}

	if user.TotpSecret.String == "" {
		logger.Warn("user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret)
	}

	valid := ctrl.totp.Validate(req.Body.Code, user.TotpSecret.String)
	if !valid {
		logger.Warn("invalid totp")
		return ctrl.sendError(ErrInvalidTotp)
	}

	if err := ctrl.wf.db.UpdateUserActiveMFAType(
		ctx, sql.UpdateUserActiveMFATypeParams{
			ID:            user.ID,
			ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
		},
	); err != nil {
		logger.Error("failed to update active MFA type", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	return api.PostUserMfa200JSONResponse(api.OK)
}

func (ctrl *Controller) postUserMfaActivate( //nolint:ireturn
	ctx context.Context,
	req api.PostUserMfaRequestObject,
	user sql.AuthUser,
	logger *slog.Logger,
) api.PostUserMfaResponseObject {
	logger.Info("activating mfa")

	if user.ActiveMfaType.String == string(api.Totp) {
		logger.Warn("user already has totp mfa active")
		return ctrl.sendError(ErrTotpAlreadyActive)
	}

	if user.TotpSecret.String == "" {
		logger.Warn("user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret)
	}

	valid := ctrl.totp.Validate(req.Body.Code, user.TotpSecret.String)
	if !valid {
		logger.Warn("invalid totp")
		return ctrl.sendError(ErrInvalidTotp)
	}

	if err := ctrl.wf.db.UpdateUserActiveMFAType(
		ctx, sql.UpdateUserActiveMFATypeParams{
			ID:            user.ID,
			ActiveMfaType: sql.Text(api.Totp),
		},
	); err != nil {
		logger.Error("failed to update TOTP secret", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	return api.PostUserMfa200JSONResponse(api.OK)
}

func (ctrl *Controller) PostUserMfa( //nolint:ireturn
	ctx context.Context, req api.PostUserMfaRequestObject,
) (api.PostUserMfaResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.MfaEnabled {
		logger.Warn("mfa disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	switch {
	case req.Body.ActiveMfaType == nil || *req.Body.ActiveMfaType == "":
		return ctrl.postUserMfaDeactivate(ctx, req, user, logger), nil
	case *req.Body.ActiveMfaType == api.Totp:
		return ctrl.postUserMfaActivate(ctx, req, user, logger), nil
	}

	logger.Warn("invalid mfa type, we shouldn't be here")
	return ctrl.sendError(ErrInternalServerError), nil
}
