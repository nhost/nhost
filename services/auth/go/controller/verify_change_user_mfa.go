package controller

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) postUserMfaDeactivate( //nolint:ireturn
	ctx context.Context,
	req api.VerifyChangeUserMfaRequestObject,
	user sql.AuthUser,
	logger *slog.Logger,
) api.VerifyChangeUserMfaResponseObject {
	logger.InfoContext(ctx, "deactivating mfa")

	if user.ActiveMfaType.String != string(api.Totp) {
		logger.WarnContext(ctx, "user does not have totp mfa enabled")
		return ctrl.sendError(ErrDisabledMfaTotp)
	}

	if user.TotpSecret.String == "" {
		logger.WarnContext(ctx, "user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret)
	}

	totpSecret, err := ctrl.encrypter.Decrypt([]byte(user.TotpSecret.String))
	if err != nil {
		logger.ErrorContext(ctx, "failed to decrypt totp secret", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	valid := ctrl.totp.Validate(req.Body.Code, string(totpSecret))
	if !valid {
		logger.WarnContext(ctx, "invalid totp")
		return ctrl.sendError(ErrInvalidTotp)
	}

	if err := ctrl.wf.db.UpdateUserActiveMFAType(
		ctx, sql.UpdateUserActiveMFATypeParams{
			ID:            user.ID,
			ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
		},
	); err != nil {
		logger.ErrorContext(ctx, "failed to update active MFA type", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	return api.VerifyChangeUserMfa200JSONResponse(api.OK)
}

func (ctrl *Controller) postUserMfaActivate( //nolint:ireturn
	ctx context.Context,
	req api.VerifyChangeUserMfaRequestObject,
	user sql.AuthUser,
	logger *slog.Logger,
) api.VerifyChangeUserMfaResponseObject {
	logger.InfoContext(ctx, "activating mfa")

	if user.ActiveMfaType.String == string(api.Totp) {
		logger.WarnContext(ctx, "user already has totp mfa active")
		return ctrl.sendError(ErrTotpAlreadyActive)
	}

	if user.TotpSecret.String == "" {
		logger.WarnContext(ctx, "user does not have totp secret")
		return ctrl.sendError(ErrNoTotpSecret)
	}

	totpSecret, err := ctrl.encrypter.Decrypt([]byte(user.TotpSecret.String))
	if err != nil {
		logger.ErrorContext(ctx, "failed to decrypt totp secret", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	valid := ctrl.totp.Validate(req.Body.Code, string(totpSecret))
	if !valid {
		logger.WarnContext(ctx, "invalid totp")
		return ctrl.sendError(ErrInvalidTotp)
	}

	if err := ctrl.wf.db.UpdateUserActiveMFAType(
		ctx, sql.UpdateUserActiveMFATypeParams{
			ID:            user.ID,
			ActiveMfaType: sql.Text(api.Totp),
		},
	); err != nil {
		logger.ErrorContext(ctx, "failed to update TOTP secret", logError(err))
		return ctrl.sendError(ErrInternalServerError)
	}

	return api.VerifyChangeUserMfa200JSONResponse(api.OK)
}

func (ctrl *Controller) VerifyChangeUserMfa( //nolint:ireturn
	ctx context.Context, req api.VerifyChangeUserMfaRequestObject,
) (api.VerifyChangeUserMfaResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.MfaEnabled {
		logger.WarnContext(ctx, "mfa disabled")
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

	logger.WarnContext(ctx, "invalid mfa type, we shouldn't be here")

	return ctrl.sendError(ErrInternalServerError), nil
}
