package controller

import (
	"context"
	"log/slog"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/notifications"
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

	if ctrl.config.RequireEmailVerification || ctrl.config.DisableNewUsers {
		return ctrl.postSignupWebauthnVerifyWithEmailVerificationOrUserDisabled(
			ctx, webauthnUser, credResult, options, nickname, logger,
		)
	}

	return ctrl.postSignupWebauthnVerifyWithoutEmailVerificationOrUserDisabled(
		ctx, webauthnUser, credResult, options, nickname, logger,
	)
}

func (ctrl *Controller) postSignupWebauthnVerifyWithEmailVerificationOrUserDisabled( //nolint:ireturn
	ctx context.Context,
	webauthnUser WebauthnUser,
	credResult *webauthn.Credential,
	options *api.SignUpOptions,
	nickname string,
	logger *slog.Logger,
) (api.PostSignupWebauthnVerifyResponseObject, error) {
	ticket := generateTicket(TicketTypeVerifyEmail)
	expireAt := time.Now().Add(InAMonth)

	if _, err := ctrl.wf.SignupUserWithSecurityKey(
		ctx,
		webauthnUser.ID,
		webauthnUser.Email,
		ticket,
		expireAt,
		options,
		credResult.ID,
		credResult.PublicKey,
		nickname,
		logger,
	); err != nil {
		return ctrl.respondWithError(err), nil
	}

	if ctrl.config.DisableNewUsers {
		return api.PostSignupWebauthnVerify200JSONResponse{Session: nil}, nil
	}

	if err := ctrl.wf.SendEmail(
		ctx,
		webauthnUser.Email,
		deptr(options.Locale),
		LinkTypeEmailVerify,
		ticket,
		deptr(options.RedirectTo),
		notifications.TemplateNameEmailVerify,
		deptr(options.DisplayName),
		webauthnUser.Email,
		"",
		logger,
	); err != nil {
		return nil, err
	}

	return api.PostSignupWebauthnVerify200JSONResponse{Session: nil}, nil
}

func (ctrl *Controller) postSignupWebauthnVerifyWithoutEmailVerificationOrUserDisabled( //nolint:ireturn
	ctx context.Context,
	webauthnUser WebauthnUser,
	credResult *webauthn.Credential,
	options *api.SignUpOptions,
	nickname string,
	logger *slog.Logger,
) (api.PostSignupWebauthnVerifyResponseObject, error) {
	refreshToken := uuid.New()
	expiresAt := time.Now().Add(time.Duration(ctrl.config.RefreshTokenExpiresIn) * time.Second)

	user, refreshTokenID, apiErr := ctrl.wf.SignupUserWithSecurityKeyAndRefreshToken(
		ctx,
		webauthnUser.ID,
		webauthnUser.Email,
		refreshToken,
		expiresAt,
		options,
		credResult.ID,
		credResult.PublicKey,
		nickname,
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	accessToken, expiresIn, err := ctrl.wf.jwtGetter.GetToken(
		ctx, webauthnUser.ID, false, deptr(options.AllowedRoles), *options.DefaultRole, logger,
	)
	if err != nil {
		logger.Error("error getting jwt", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSignupWebauthnVerify200JSONResponse{
		Session: &api.Session{
			AccessToken:          accessToken,
			AccessTokenExpiresIn: expiresIn,
			RefreshTokenId:       refreshTokenID.String(),
			RefreshToken:         refreshToken.String(),
			User:                 user,
		},
	}, nil
}
