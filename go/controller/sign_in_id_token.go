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

func (ctrl *Controller) postSigninIdtokenCheckUserExists(
	ctx context.Context, email, providerID, providerUserID string, logger *slog.Logger,
) (sql.AuthUser, bool, bool, *APIError) {
	user, apiError := ctrl.wf.GetUserByProviderUserID(ctx, providerID, providerUserID, logger)
	switch {
	case errors.Is(apiError, ErrUserProviderNotFound):
	case apiError != nil:
		logger.ErrorContext(ctx, "error getting user by provider user id", logError(apiError))
		return user, false, false, apiError
	default:
		return user, true, true, nil
	}

	user, apiError = ctrl.wf.GetUserByEmail(ctx, email, logger)
	switch {
	case errors.Is(apiError, ErrUserEmailNotFound):
	case apiError != nil:
		logger.ErrorContext(ctx, "error getting user by email", logError(apiError))
		return sql.AuthUser{}, false, false, ErrInternalServerError
	default:
		return user, true, false, nil
	}

	return user, false, false, nil
}

func (ctrl *Controller) SignInIdToken( //nolint:ireturn,revive,stylecheck
	ctx context.Context, req api.SignInIdTokenRequestObject,
) (api.SignInIdTokenResponseObject, error) {
	logger := middleware.LoggerFromContext(ctx)

	profile, apiError := ctrl.wf.GetOIDCProfileFromIDToken(
		ctx,
		req.Body.Provider,
		req.Body.IdToken,
		req.Body.Nonce,
		logger,
	)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	if !ctrl.wf.ValidateEmail(profile.Email) {
		logger.ErrorContext(ctx, "invalid email", slog.String("email", profile.Email))
		return ctrl.respondWithError(ErrInvalidEmailPassword), nil
	}

	session, apiErr := ctrl.providerSignInFlow(
		ctx, profile, string(req.Body.Provider), req.Body.Options, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignInIdToken200JSONResponse{
		Session: session,
	}, nil
}

func (ctrl *Controller) providerSignInFlow(
	ctx context.Context,
	profile oidc.Profile,
	provider string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	user, userFound, providerFound, apiError := ctrl.postSigninIdtokenCheckUserExists(
		ctx, profile.Email, provider, profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return nil, apiError
	}

	if userFound {
		return ctrl.providerFlowSignIn(
			ctx, user, providerFound, provider, profile.ProviderUserID, logger,
		)
	}

	return ctrl.providerFlowSignUp(ctx, provider, profile, options, logger)
}

func (ctrl *Controller) providerFlowSignUpValidateOptions(
	ctx context.Context, options *api.SignUpOptions, profile oidc.Profile, logger *slog.Logger,
) (*api.SignUpOptions, *APIError) {
	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup disabled")
		return nil, ErrSignupDisabled
	}

	if profile.Email != "" {
		if err := ctrl.wf.ValidateSignupEmail(ctx, types.Email(profile.Email), logger); err != nil {
			return nil, err
		}
	}

	if options == nil {
		options = &api.SignUpOptions{} //nolint:exhaustruct
	}

	if options.DisplayName == nil && profile.Name != "" {
		options.DisplayName = &profile.Name
	}

	options, err := ctrl.wf.ValidateSignUpOptions(
		ctx, options, profile.ProviderUserID, logger,
	)
	if err != nil {
		return nil, err
	}

	return options, nil
}

func (ctrl *Controller) providerFlowSignUp(
	ctx context.Context,
	provider string,
	profile oidc.Profile,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	logger.InfoContext(ctx, "user doesn't exist, signing up")

	options, apiError := ctrl.providerFlowSignUpValidateOptions(ctx, options, profile, logger)
	if apiError != nil {
		return nil, apiError
	}

	session, apiErr := ctrl.wf.SignupUserWithFn(
		ctx,
		profile.Email,
		options,
		profile.Email != "" && !profile.EmailVerified,
		ctrl.providerFlowSignupWithSession(ctx, profile, provider, options),
		ctrl.providerFlowSignupWithoutSession(ctx, profile, provider, options),
		logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	if session != nil {
		session.User.AvatarUrl = profile.Picture
		session.User.EmailVerified = profile.EmailVerified
	}

	return session, nil
}

func (ctrl *Controller) providerFlowSignupWithSession(
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

		var email pgtype.Text
		if profile.Email != "" {
			email = sql.Text(profile.Email)
		}

		resp, err := ctrl.wf.db.InsertUserWithUserProviderAndRefreshToken(
			ctx, sql.InsertUserWithUserProviderAndRefreshTokenParams{
				ID:                    uuid.New(),
				Disabled:              ctrl.config.DisableNewUsers,
				DisplayName:           deptr(options.DisplayName),
				AvatarUrl:             avatarURL,
				Email:                 email,
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

func (ctrl *Controller) providerFlowSignupWithoutSession(
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

		var email pgtype.Text
		if profile.Email != "" {
			email = sql.Text(profile.Email)
		}

		_, err := ctrl.wf.db.InsertUserWithUserProvider(ctx, sql.InsertUserWithUserProviderParams{
			ID:              uuid.New(),
			Disabled:        ctrl.config.DisableNewUsers,
			DisplayName:     deptr(options.DisplayName),
			AvatarUrl:       avatarURL,
			Email:           email,
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

func (ctrl *Controller) providerFlowSignIn(
	ctx context.Context,
	user sql.AuthUser,
	providerFound bool,
	provider string,
	providerUserID string,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	logger.InfoContext(ctx, "user found, signing in")

	if !providerFound {
		if _, apiErr := ctrl.wf.InsertUserProvider(
			ctx,
			user.ID,
			provider,
			providerUserID,
			logger,
		); apiErr != nil {
			return nil, apiErr
		}
	}

	session, err := ctrl.wf.NewSession(ctx, user, nil, logger)
	if err != nil {
		logger.ErrorContext(ctx, "error getting new session", logError(err))
		return nil, ErrInternalServerError
	}

	return session, nil
}
