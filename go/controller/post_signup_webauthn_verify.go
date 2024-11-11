package controller

import (
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/sql"
)

func (ctrl *Controller) postSignupWebauthnVerifyValidateRequest( //nolint:cyclop,funlen
	request api.PostSignupWebauthnVerifyRequestObject,
	logger *slog.Logger,
) (*protocol.ParsedCredentialCreationData, *api.SignUpOptions, string, *APIError) {
	if !ctrl.config.WebauthnEnabled {
		logger.Error("webauthn is disabled")
		return nil, nil, "", ErrDisabledEndpoint
	}

	if ctrl.config.DisableSignup {
		logger.Error("signup is disabled")
		return nil, nil, "", ErrSignupDisabled
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.Error("error parsing credential data", logError(err))
		return nil, nil, "", ErrInvalidRequest
	}

	ch, ok := ctrl.Webauthn.Storage[credData.Response.CollectedClientData.Challenge]
	if !ok {
		logger.Error("challenge not found")
		return nil, nil, "", ErrInvalidRequest
	}

	options := ch.Options
	var apiErr *APIError
	if request.Body.Options != nil { //nolint:nestif
		if request.Body.Options.AllowedRoles == nil {
			options.AllowedRoles = request.Body.Options.AllowedRoles
		}

		if request.Body.Options.DefaultRole == nil {
			options.DefaultRole = request.Body.Options.DefaultRole
		}

		if request.Body.Options.DisplayName == nil {
			options.DisplayName = request.Body.Options.DisplayName
		}

		if request.Body.Options.Locale == nil {
			options.Locale = request.Body.Options.Locale
		}

		if request.Body.Options.Metadata == nil {
			options.Metadata = request.Body.Options.Metadata
		}

		if request.Body.Options.RedirectTo == nil {
			options.RedirectTo = request.Body.Options.RedirectTo
		}

		options, apiErr = ctrl.wf.ValidateSignUpOptions(options, ch.User.Email, logger)
		if apiErr != nil {
			return nil, nil, "", apiErr
		}
	}

	nickname := ""
	if request.Body.Options != nil && request.Body.Options.Nickname != nil {
		nickname = *request.Body.Options.Nickname
	}

	return credData, options, nickname, nil
}

func (ctrl *Controller) PostSignupWebauthnVerify( //nolint:ireturn
	ctx context.Context,
	request api.PostSignupWebauthnVerifyRequestObject,
) (api.PostSignupWebauthnVerifyResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	credData, options, nickname, apiErr := ctrl.postSignupWebauthnVerifyValidateRequest(
		request,
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credResult, webauthnUser, apiErr := ctrl.Webauthn.FinishRegistration(credData, logger)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	session, apiErr := ctrl.wf.SignupUserWithFn(
		ctx,
		webauthnUser.Email,
		options,
		true,
		ctrl.postSignupWebauthnVerifyWithSession(
			ctx, webauthnUser, options, credResult, nickname,
		),
		ctrl.postSignupWebauthnVerifyWithoutSession(
			ctx, webauthnUser, options, credResult, nickname,
		),
		logger,
	)

	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	return api.PostSignupWebauthnVerify200JSONResponse{Session: session}, nil
}

func (ctrl *Controller) postSignupWebauthnVerifyWithSession(
	ctx context.Context,
	webauthnUser WebauthnUser,
	options *api.SignUpOptions,
	credResult *webauthn.Credential,
	nickname string,
) databaseWithSessionFn {
	return func(
		refreshTokenHash pgtype.Text,
		refreshTokenExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) (uuid.UUID, uuid.UUID, error) {
		resp, err := ctrl.wf.db.InsertUserWithSecurityKeyAndRefreshToken(
			ctx, sql.InsertUserWithSecurityKeyAndRefreshTokenParams{
				ID:                    webauthnUser.ID,
				Disabled:              ctrl.config.DisableNewUsers,
				DisplayName:           deptr(options.DisplayName),
				AvatarUrl:             gravatarURL,
				Email:                 sql.Text(webauthnUser.Email),
				Ticket:                pgtype.Text{}, //nolint:exhaustruct
				TicketExpiresAt:       sql.TimestampTz(time.Now()),
				EmailVerified:         false,
				Locale:                deptr(options.Locale),
				DefaultRole:           deptr(options.DefaultRole),
				Metadata:              metadata,
				Roles:                 deptr(options.AllowedRoles),
				RefreshTokenHash:      refreshTokenHash,
				RefreshTokenExpiresAt: refreshTokenExpiresAt,
				CredentialID:          base64.RawURLEncoding.EncodeToString(credResult.ID),
				CredentialPublicKey:   credResult.PublicKey,
				Nickname:              sql.Text(nickname),
			},
		)
		if err != nil {
			return uuid.Nil, uuid.Nil,
				fmt.Errorf("error inserting user with security key and refresh token: %w", err)
		}

		return resp.ID, resp.RefreshTokenID, nil
	}
}

func (ctrl *Controller) postSignupWebauthnVerifyWithoutSession(
	ctx context.Context,
	webauthnUser WebauthnUser,
	options *api.SignUpOptions,
	credResult *webauthn.Credential,
	nickname string,
) databaseWithoutSessionFn {
	return func(
		ticket pgtype.Text,
		ticketExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) error {
		_, err := ctrl.wf.db.InsertUserWithSecurityKey(
			ctx, sql.InsertUserWithSecurityKeyParams{
				ID:                  webauthnUser.ID,
				Disabled:            ctrl.wf.config.DisableNewUsers,
				DisplayName:         deptr(options.DisplayName),
				AvatarUrl:           gravatarURL,
				Email:               sql.Text(webauthnUser.Email),
				Ticket:              ticket,
				TicketExpiresAt:     ticketExpiresAt,
				EmailVerified:       false,
				Locale:              deptr(options.Locale),
				DefaultRole:         deptr(options.DefaultRole),
				Metadata:            metadata,
				Roles:               deptr(options.AllowedRoles),
				CredentialID:        base64.RawURLEncoding.EncodeToString(credResult.ID),
				CredentialPublicKey: credResult.PublicKey,
				Nickname:            sql.Text(nickname),
			},
		)
		if err != nil {
			return fmt.Errorf("error inserting user with security key: %w", err)
		}

		return nil
	}
}
