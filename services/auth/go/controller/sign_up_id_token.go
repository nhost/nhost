package controller

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
)

func (ctrl *Controller) SignUpIdToken( //nolint:ireturn,revive
	ctx context.Context, req api.SignUpIdTokenRequestObject,
) (api.SignUpIdTokenResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

	if ctrl.config.DisableSignup {
		logger.WarnContext(ctx, "signup is disabled")
		return ctrl.sendError(ErrSignupDisabled), nil
	}

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
		logger.ErrorContext(ctx, "invalid email")
		return ctrl.respondWithError(ErrInvalidEmailPassword), nil
	}

	// Check if user already exists
	_, userFound, _, apiError := ctrl.postSigninIdtokenCheckUserExists(
		ctx, profile.Email, string(req.Body.Provider), profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return ctrl.respondWithError(apiError), nil
	}

	if userFound {
		logger.WarnContext(ctx, "user already exists")
		return ctrl.respondWithError(ErrUserAlreadyExists), nil
	}

	// Call providerFlowSignUp directly since we've already verified user doesn't exist
	session, apiErr := ctrl.providerFlowSignUp(
		ctx, string(req.Body.Provider), profile, req.Body.Options, logger,
	)
	if apiErr != nil {
		return ctrl.respondWithError(apiErr), nil
	}

	return api.SignUpIdToken200JSONResponse{
		Session: session,
	}, nil
}

// providerSignUpFlow is used by explicit signup endpoints to check if user exists
// and return an error if they do, otherwise proceed with signup.
func (ctrl *Controller) providerSignUpFlow(
	ctx context.Context,
	profile oidc.Profile,
	provider string,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	_, userFound, _, apiError := ctrl.postSigninIdtokenCheckUserExists(
		ctx, profile.Email, provider, profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return nil, apiError
	}

	if userFound {
		logger.WarnContext(ctx, "user already exists")
		return nil, ErrUserAlreadyExists
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
		profile.Email != "" && !profile.EmailVerified.IsVerified(),
		ctrl.providerFlowSignupWithSession(ctx, profile, provider, options),
		ctrl.providerFlowSignupWithoutSession(ctx, profile, provider, options),
		"",
		logger,
	)
	if apiErr != nil {
		return nil, apiErr
	}

	if session != nil {
		session.User.AvatarUrl = profile.Picture
		session.User.EmailVerified = profile.EmailVerified.IsVerified()
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
				EmailVerified:         profile.EmailVerified.IsVerified(),
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
			EmailVerified:   profile.EmailVerified.IsVerified(),
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
