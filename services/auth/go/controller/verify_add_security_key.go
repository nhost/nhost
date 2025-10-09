package controller

import (
	"context"
	"encoding/base64"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) VerifyAddSecurityKey( //nolint:ireturn
	ctx context.Context,
	request api.VerifyAddSecurityKeyRequestObject,
) (api.VerifyAddSecurityKeyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return ctrl.sendError(ErrDisabledEndpoint), nil
	}

	user, apiErr := ctrl.wf.GetUserFromJWTInContext(ctx, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.ErrorContext(ctx, "error parsing credential data", logError(err))
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	credential, webauthnUser, apiErr := ctrl.Webauthn.FinishRegistration(ctx, credData, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	if webauthnUser.ID != user.ID {
		logger.ErrorContext(ctx, "webauthn user ID mismatch")
		return ctrl.sendError(ErrInvalidRequest), nil
	}

	var nickname pgtype.Text
	if request.Body.Nickname != nil {
		nickname = sql.Text(*request.Body.Nickname)
	}

	securityKeyID, err := ctrl.wf.db.InsertSecurityKey(
		ctx,
		sql.InsertSecurityKeyParams{
			UserID:              user.ID,
			CredentialID:        base64.RawURLEncoding.EncodeToString(credential.ID),
			CredentialPublicKey: credential.PublicKey,
			Nickname:            nickname,
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error inserting security key", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.VerifyAddSecurityKey200JSONResponse{
		Id:       securityKeyID.String(),
		Nickname: request.Body.Nickname,
	}, nil
}
