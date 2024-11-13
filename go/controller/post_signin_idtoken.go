package controller

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/middleware"
	"github.com/nhost/hasura-auth/go/oidc"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
)

func (ctrl *Controller) postSigninIdtokenValidateRequest(
	req api.PostSigninIdtokenRequestObject, profile oidc.Profile, logger *slog.Logger,
) (api.PostSigninIdtokenRequestObject, *APIError) {
	if ctrl.config.DisableSignup {
		logger.Warn("signup disabled")
		return api.PostSigninIdtokenRequestObject{}, ErrSignupDisabled
	}

	if err := ctrl.wf.ValidateSignupEmail(types.Email(profile.Email), logger); err != nil {
		return api.PostSigninIdtokenRequestObject{}, err
	}

	if req.Body.Options == nil {
		req.Body.Options = &api.SignUpOptions{} //nolint:exhaustruct
	}

	if req.Body.Options.DisplayName == nil && profile.Name != "" {
		req.Body.Options.DisplayName = &profile.Name
	}

	options, err := ctrl.wf.ValidateSignUpOptions(
		req.Body.Options, profile.Email, logger,
	)
	if err != nil {
		return api.PostSigninIdtokenRequestObject{}, err
	}

	req.Body.Options = options

	return req, nil
}

func (ctrl *Controller) postSigninIdtokenCheckUserExists(
	ctx context.Context, email, providerID, providerUserID string, logger *slog.Logger,
) (sql.AuthUser, bool, *APIError) {
	user, apiError := ctrl.wf.GetUserByProviderUserID(ctx, providerID, providerUserID, logger)
	switch {
	case errors.Is(apiError, ErrUserProviderNotFound):
	case apiError != nil:
		logger.Error("error getting user by provider user id", logError(apiError))
		return user, false, apiError
	default:
		return user, true, nil
	}

	user, apiError = ctrl.wf.GetUserByEmail(ctx, email, logger)
	switch {
	case errors.Is(apiError, ErrUserEmailNotFound):
	case apiError != nil:
		logger.Error("error getting user by email", logError(apiError))
		return sql.AuthUser{}, false, ErrInternalServerError
	default:
		return user, true, nil
	}

	return user, false, nil
}

func (ctrl *Controller) PostSigninIdtoken( //nolint:ireturn
	ctx context.Context, req api.PostSigninIdtokenRequestObject,
) (api.PostSigninIdtokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	profile, apiError := ctrl.wf.GetOIDCProfileFromIDToken(
		req.Body.Provider,
		req.Body.IdToken,
		req.Body.Nonce,
		logger,
	)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	if !ctrl.wf.ValidateEmail(profile.Email) {
		logger.Error("invalid email", slog.String("email", profile.Email))
		return ctrl.respondWithError(ErrInvalidEmailPassword), nil
	}

	user, found, apiError := ctrl.postSigninIdtokenCheckUserExists(
		ctx, profile.Email, string(req.Body.Provider), profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	if found {
		return ctrl.postSigninIdtokenSignin(ctx, user, logger)
	}

	return ctrl.postSigninIdtokenSignup(ctx, req, profile, logger)
}

func (ctrl *Controller) postSigninIdtokenSignup( //nolint:ireturn
	ctx context.Context,
	req api.PostSigninIdtokenRequestObject,
	profile oidc.Profile,
	logger *slog.Logger,
) (api.PostSigninIdtokenResponseObject, error) {
	logger.Info("user doesn't exist, signing up")

	req, apiError := ctrl.postSigninIdtokenValidateRequest(req, profile, logger)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	session, apiErr := ctrl.wf.SignupUserWithFn(
		ctx,
		profile.Email,
		req.Body.Options,
		false,
		ctrl.postSigninIdtokenSignupWithSession(
			ctx, profile, string(req.Body.Provider), req.Body.Options,
		),
		ctrl.postSigninIdtokenSignupWithoutSession(
			ctx, profile, string(req.Body.Provider), req.Body.Options,
		),
		logger,
	)
	if apiErr != nil {
		return ctrl.sendError(apiErr), nil
	}

	session.User.AvatarUrl = profile.Picture
	session.User.EmailVerified = profile.EmailVerified

	return api.PostSigninIdtoken200JSONResponse{Session: session}, nil
}

func (ctrl *Controller) postSigninIdtokenSignupWithSession(
	ctx context.Context,
	profile oidc.Profile,
	providerID string,
	options *api.SignUpOptions,
) databaseWithSessionFn {
	return func(
		refreshTokenHash pgtype.Text,
		refreshTokenExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) (uuid.UUID, uuid.UUID, error) {
		avatarURL := gravatarURL
		if profile.Picture != "" {
			avatarURL = profile.Picture
		}

		resp, err := ctrl.wf.db.InsertUserWithUserProviderAndRefreshToken(
			ctx, sql.InsertUserWithUserProviderAndRefreshTokenParams{
				ID:                    uuid.New(),
				Disabled:              ctrl.config.DisableNewUsers,
				DisplayName:           deptr(options.DisplayName),
				AvatarUrl:             avatarURL,
				Email:                 sql.Text(profile.Email),
				Ticket:                pgtype.Text{}, //nolint:exhaustruct
				TicketExpiresAt:       sql.TimestampTz(time.Now()),
				EmailVerified:         profile.EmailVerified,
				Locale:                deptr(options.Locale),
				DefaultRole:           deptr(options.DefaultRole),
				Metadata:              metadata,
				Roles:                 deptr(options.AllowedRoles),
				RefreshTokenHash:      refreshTokenHash,
				RefreshTokenExpiresAt: refreshTokenExpiresAt,
				ProviderID:            providerID,
				ProviderUserID:        profile.ProviderUserID,
			},
		)
		if err != nil {
			return uuid.Nil, uuid.Nil,
				fmt.Errorf("error inserting user with refresh token: %w", err)
		}

		return resp.ID, resp.RefreshTokenID, nil
	}
}

func (ctrl *Controller) postSigninIdtokenSignupWithoutSession(
	ctx context.Context,
	profile oidc.Profile,
	providerID string,
	options *api.SignUpOptions,
) databaseWithoutSessionFn {
	return func(
		ticket pgtype.Text,
		ticketExpiresAt pgtype.Timestamptz,
		metadata []byte,
		gravatarURL string,
	) error {
		avatarURL := gravatarURL
		if profile.Picture != "" {
			avatarURL = profile.Picture
		}

		_, err := ctrl.wf.db.InsertUserWithUserProvider(ctx, sql.InsertUserWithUserProviderParams{
			ID:              uuid.New(),
			Disabled:        ctrl.config.DisableNewUsers,
			DisplayName:     deptr(options.DisplayName),
			AvatarUrl:       avatarURL,
			Email:           sql.Text(profile.Email),
			Ticket:          ticket,
			TicketExpiresAt: ticketExpiresAt,
			EmailVerified:   profile.EmailVerified,
			Locale:          deptr(options.Locale),
			DefaultRole:     deptr(options.DefaultRole),
			Metadata:        metadata,
			Roles:           deptr(options.AllowedRoles),
			ProviderID:      providerID,
			ProviderUserID:  profile.ProviderUserID,
		})
		if err != nil {
			return fmt.Errorf("error inserting user: %w", err)
		}
		return nil
	}
}

func (ctrl *Controller) postSigninIdtokenSignin( //nolint:ireturn
	ctx context.Context,
	user sql.AuthUser,
	logger *slog.Logger,
) (api.PostSigninIdtokenResponseObject, error) {
	logger.Info("user found, signing in")

	session, err := ctrl.wf.NewSession(ctx, user, logger)
	if err != nil {
		logger.Error("error getting new session", logError(err))
		return ctrl.sendError(ErrInternalServerError), nil
	}

	return api.PostSigninIdtoken200JSONResponse{
		Session: session,
	}, nil
}
