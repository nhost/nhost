package controller

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/providers"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (ctrl *Controller) lookupProviderUser(
	ctx context.Context,
	email string,
	provider providerIdentity,
	providerUserID string,
	logger *slog.Logger,
) (sql.AuthUser, bool, bool, *APIError) {
	if strings.HasPrefix(provider.id, oidc.ProviderIDPrefix) {
		if !provider.issuer.Valid {
			return sql.AuthUser{}, false, false, ErrDisabledEndpoint
		}

		return ctrl.wf.resolveOIDCIdentity(ctx, provider, providerUserID, email, logger)
	}

	user, apiError := ctrl.wf.GetUserByProviderUserID(ctx, provider.id, providerUserID, logger)
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
		return sql.AuthUser{}, false, false, apiError
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
		ctx, profile, builtinIdentity(string(req.Body.Provider)), req.Body.Options, logger,
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
	provider providerIdentity,
	options *api.SignUpOptions,
	logger *slog.Logger,
) (*api.Session, *APIError) {
	user, userFound, providerFound, apiError := ctrl.lookupProviderUser(
		ctx, profile.Email, provider, profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return nil, apiError
	}

	if userFound {
		return ctrl.providerFlowSignIn(
			ctx, user, providerFound, provider.id, profile, logger,
		)
	}

	if ctrl.config.DisableAutoSignup {
		// Return generic error to prevent account enumeration
		logger.InfoContext(ctx, "auto-signup disabled, user not found")
		return nil, ErrInvalidEmailPassword
	}

	return ctrl.providerFlowSignUp(ctx, provider, profile, options, logger)
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
		if apiErr := ctrl.wf.linkProviderByEmail(
			ctx, user.ID, provider, profile, logger,
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
// An explicit signup intent bypasses DisableAutoSignup. For that intent,
// an existing user is reported as ErrUserAlreadyExists.
// Returns uuid.Nil when the user cannot sign in yet (e.g. email verification required).
func (ctrl *Controller) providerResolveUser(
	ctx context.Context,
	profile oidc.Profile,
	provider providerIdentity,
	state *providers.State,
	logger *slog.Logger,
) (uuid.UUID, *APIError) {
	user, userFound, providerFound, apiError := ctrl.lookupProviderUser(
		ctx, profile.Email, provider, profile.ProviderUserID, logger,
	)
	if apiError != nil {
		return uuid.Nil, apiError
	}

	signupIntent := state.Flow == providers.FlowSignup
	if userFound {
		if signupIntent {
			logger.WarnContext(ctx, "user already exists")
			return uuid.Nil, ErrUserAlreadyExists
		}

		logger.InfoContext(ctx, "user found, resolving for PKCE")

		if !providerFound {
			if apiErr := ctrl.wf.linkProviderByEmail(
				ctx, user.ID, provider.id, profile, logger,
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

	var confirmationChallenge string
	if provider.issuer.Valid {
		confirmationChallenge = deptr(state.CodeChallenge)
	}

	return ctrl.providerSignUpResolveOnly(
		ctx, provider, profile, state.Options, confirmationChallenge, logger,
	)
}

// providerSignUpResolveOnly creates a new user from an OAuth provider profile
// without creating a session. Returns uuid.Nil when the user needs email
// verification before they can sign in.
func (ctrl *Controller) providerSignUpResolveOnly( //nolint:funlen
	ctx context.Context,
	provider providerIdentity,
	profile oidc.Profile,
	options *api.SignUpOptions,
	confirmationChallenge string,
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
			confirmationChallenge,
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
			ProviderID:      provider.id,
			ProviderUserID:  profile.ProviderUserID,
			Issuer:          provider.issuer,
		},
	); err != nil {
		return uuid.Nil, sqlErrIsDuplicatedEmail(ctx, err, logger)
	}

	return userID, nil
}
