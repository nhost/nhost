package controller

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
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

func (ctrl *Controller) SignInIdToken( //nolint:ireturn,revive
	ctx context.Context, req api.SignInIdTokenRequestObject,
) (api.SignInIdTokenResponseObject, error) {
	logger := oapimw.LoggerFromContext(ctx)

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
			ctx, user, providerFound, provider, profile, logger,
		)
	}

	if ctrl.config.DisableAutoSignup {
		// Return generic error to prevent account enumeration
		logger.InfoContext(ctx, "auto-signup disabled, user not found")
		return nil, ErrInvalidEmailPassword
	}

	return ctrl.providerFlowSignUp(ctx, provider, profile, options, logger)
}

// ensureProviderLinkAllowed rejects an attempt to link a new OAuth provider
// identity to an existing Nhost account when the provider has not explicitly
// attested that the caller owns the email address. EmailVerificationStatus
// values of Unknown (no signal) and Unverified are both rejected; only the
// explicit Verified status allows linking.
//
// Without this guard, an attacker could claim an unverified email on the
// OAuth provider (e.g. by changing their email to the victim's address and
// skipping confirmation) and take over the matching Nhost account.
func (ctrl *Controller) ensureProviderLinkAllowed(
	ctx context.Context,
	profile oidc.Profile,
	provider string,
	logger *slog.Logger,
) *APIError {
	if profile.EmailVerified.IsVerified() {
		return nil
	}

	logger.WarnContext(ctx,
		"refusing to link provider to existing account: email not verified by provider",
		slog.String("provider", provider),
	)

	return ErrUnverifiedUser
}

func (ctrl *Controller) providerFlowSignIn(
	ctx context.Context,
	user sql.AuthUser,
	providerFound bool,
	provider string,
	profile oidc.Profile,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	logger.InfoContext(ctx, "user found, signing in")

	if !providerFound {
		if apiErr := ctrl.ensureProviderLinkAllowed(ctx, profile, provider, logger); apiErr != nil {
			return nil, apiErr
		}

		if _, apiErr := ctrl.wf.InsertUserProvider(
			ctx,
			user.ID,
			provider,
			profile.ProviderUserID,
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

// providerResolveUser resolves or creates a user from an OAuth provider profile
// without creating a session. Used in the PKCE flow where session creation is
// deferred to the token exchange endpoint.
// When signupIntent is true the caller used the explicit /signup/provider endpoint:
// an existing user is reported as ErrUserAlreadyExists, and DisableAutoSignup is
// bypassed so the new account is created.
// Returns uuid.Nil when the user cannot sign in yet (e.g. email verification required).
func (ctrl *Controller) providerResolveUser(
	ctx context.Context,
	profile oidc.Profile,
	provider string,
	options *api.SignUpOptions,
	signupIntent bool,
	logger *slog.Logger,
) (uuid.UUID, *APIError) {
	user, userFound, providerFound, apiError := ctrl.postSigninIdtokenCheckUserExists(
		ctx, profile.Email, provider, profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return uuid.Nil, apiError
	}

	if userFound { //nolint:nestif
		if signupIntent {
			logger.WarnContext(ctx, "user already exists")
			return uuid.Nil, ErrUserAlreadyExists
		}

		logger.InfoContext(ctx, "user found, resolving for PKCE")

		if !providerFound {
			if apiErr := ctrl.ensureProviderLinkAllowed(
				ctx, profile, provider, logger,
			); apiErr != nil {
				return uuid.Nil, apiErr
			}

			if _, apiErr := ctrl.wf.InsertUserProvider(
				ctx,
				user.ID,
				provider,
				profile.ProviderUserID,
				logger,
			); apiErr != nil {
				return uuid.Nil, apiErr
			}
		}

		return user.ID, nil
	}

	if !signupIntent && ctrl.config.DisableAutoSignup {
		logger.InfoContext(ctx, "auto-signup disabled, user not found")
		return uuid.Nil, ErrInvalidEmailPassword
	}

	return ctrl.providerSignUpResolveOnly(ctx, provider, profile, options, logger)
}

// providerSignUpResolveOnly creates a new user from an OAuth provider profile
// without creating a session. Returns uuid.Nil when the user needs email
// verification before they can sign in.
func (ctrl *Controller) providerSignUpResolveOnly( //nolint:cyclop,funlen
	ctx context.Context,
	provider string,
	profile oidc.Profile,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (uuid.UUID, *APIError) {
	logger.InfoContext(ctx, "user doesn't exist, signing up (PKCE)")

	options, apiError := ctrl.providerFlowSignUpValidateOptions(ctx, options, profile, logger)
	if apiError != nil {
		return uuid.Nil, apiError
	}

	sendConfirmationEmail := profile.Email != "" && !profile.EmailVerified.IsVerified()

	// If email verification is needed or new users are disabled,
	// use the existing sign-up-without-session flow and signal that
	// PKCE cannot proceed yet by returning uuid.Nil.
	if (sendConfirmationEmail && ctrl.config.RequireEmailVerification) ||
		ctrl.config.DisableNewUsers {
		apiErr := ctrl.wf.SignupUserWithouthSession(
			ctx, profile.Email, options, sendConfirmationEmail,
			ctrl.providerFlowSignupWithoutSession(ctx, profile, provider, options),
			"",
			logger,
		)
		if apiErr != nil {
			return uuid.Nil, apiErr
		}

		return uuid.Nil, nil
	}

	// Create user with provider but without a session/refresh token.
	metadata, err := json.Marshal(options.Metadata)
	if err != nil {
		logger.ErrorContext(ctx, "error marshaling metadata", logError(err))
		return uuid.Nil, ErrInternalServerError
	}

	avatarURL := ctrl.wf.gravatarURL(profile.Email)
	if profile.Picture != "" {
		avatarURL = profile.Picture
	}

	var email pgtype.Text
	if profile.Email != "" {
		email = sql.Text(profile.Email)
	}

	userID := uuid.New()

	if _, err := ctrl.wf.db.InsertUserWithUserProvider(
		ctx,
		sql.InsertUserWithUserProviderParams{
			ID:              userID,
			Disabled:        false,
			DisplayName:     deptr(options.DisplayName),
			AvatarUrl:       avatarURL,
			Email:           email,
			Ticket:          pgtype.Text{}, //nolint:exhaustruct
			TicketExpiresAt: sql.TimestampTz(time.Now()),
			EmailVerified:   profile.EmailVerified.IsVerified(),
			Locale:          deptr(options.Locale),
			DefaultRole:     deptr(options.DefaultRole),
			Metadata:        metadata,
			Roles:           deptr(options.AllowedRoles),
			ProviderID:      provider,
			ProviderUserID:  profile.ProviderUserID,
		},
	); err != nil {
		return uuid.Nil, sqlErrIsDuplicatedEmail(ctx, err, logger)
	}

	return userID, nil
}
