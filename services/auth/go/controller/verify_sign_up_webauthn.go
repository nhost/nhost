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
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) postSignupWebauthnVerifyValidateRequest( //nolint:cyclop
	ctx context.Context,
	request api.VerifySignUpWebauthnRequestObject,
	logger *slog.Logger,
) (*protocol.ParsedCredentialCreationData, *api.SignUpOptions, string, *APIError) {
	if !ctrl.config.WebauthnEnabled {
		logger.ErrorContext(ctx, "webauthn is disabled")
		return nil, nil, "", ErrDisabledEndpoint
	}

	if ctrl.config.DisableSignup {
		logger.ErrorContext(ctx, "signup is disabled")
		return nil, nil, "", ErrSignupDisabled
	}

	credData, err := request.Body.Credential.Parse()
	if err != nil {
		logger.ErrorContext(ctx, "error parsing credential data", logError(err))
		return nil, nil, "", ErrInvalidRequest
	}

	ch, ok := ctrl.Webauthn.Storage[credData.Response.CollectedClientData.Challenge]
	if !ok {
		logger.ErrorContext(ctx, "challenge not found")
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

		options, apiErr = ctrl.wf.ValidateSignUpOptions(ctx, options, ch.User.Email, logger)
		if apiErr != nil {
			return nil, nil, "", apiErr
		}
	}

	return credData, options, deptr(request.Body.Nickname), nil
}

func (ctrl *Controller) VerifySignUpWebauthn( //nolint:ireturn
	ctx context.Context,
	request api.VerifySignUpWebauthnRequestObject,
) (api.VerifySignUpWebauthnResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	credData, options, nickname, apiErr := ctrl.postSignupWebauthnVerifyValidateRequest(
		ctx,
		request,
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	credResult, webauthnUser, apiErr := ctrl.Webauthn.FinishRegistration(ctx, credData, logger)
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

	return api.VerifySignUpWebauthn200JSONResponse{Session: session}, nil
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
