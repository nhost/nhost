package controller

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
)

type providerIdentity struct {
	id     string
	issuer pgtype.Text
}

func builtinIdentity(id string) providerIdentity {
	return providerIdentity{id: id, issuer: pgtype.Text{String: "", Valid: false}}
}

func customIdentity(provider *oidc.CustomProvider) providerIdentity {
	return providerIdentity{id: provider.ID(), issuer: sql.Text(provider.Issuer())}
}

func (wf *Workflows) connectProvider(
	ctx context.Context,
	userID uuid.UUID,
	provider providerIdentity,
	subject string,
	logger *slog.Logger,
) *APIError {
	if _, apiErr := wf.GetUser(ctx, userID, logger); apiErr != nil {
		logger.ErrorContext(ctx, "error getting user", logError(apiErr))

		return apiErr
	}

	return wf.insertUserProvider(ctx, userID, provider, subject, logger)
}

func (wf *Workflows) resolveOIDCIdentity(
	ctx context.Context, provider providerIdentity, subject, email string, logger *slog.Logger,
) (sql.AuthUser, bool, bool, *APIError) {
	user, err := wf.db.GetUserByOIDCIdentity(ctx, sql.GetUserByOIDCIdentityParams{
		ProviderID: provider.id,
		Issuer:     provider.issuer,
		Subject:    subject,
	})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		// A verified email still cannot claim an existing account through
		// a custom provider. The signup insert enforces email uniqueness.
		if email == "" {
			return sql.AuthUser{}, false, false, ErrInvalidEmailPassword
		}

		return user, false, false, nil
	case err != nil:
		logger.ErrorContext(ctx, "error looking up OIDC identity", logError(err))
		return sql.AuthUser{}, false, false, ErrInternalServerError
	}

	if apiErr := wf.ValidateUser(ctx, user, logger); apiErr != nil {
		return user, false, false, apiErr
	}

	return user, true, true, nil
}

func (wf *Workflows) linkProviderByEmail(
	ctx context.Context,
	userID uuid.UUID,
	providerID string,
	profile oidc.Profile,
	logger *slog.Logger,
) *APIError {
	if !profile.EmailVerified.IsVerified() {
		logger.WarnContext(
			ctx, "refusing to link provider to existing account: email not verified by provider",
			slog.String("provider", providerID),
		)

		return ErrUnverifiedUser
	}

	_, err := wf.db.InsertUserProviderByEmail(ctx, sql.InsertUserProviderByEmailParams{
		UserID:         userID,
		ProviderID:     providerID,
		ProviderUserID: profile.ProviderUserID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "refusing to link provider to OIDC account by email")
		return ErrProviderAccountAlreadyLinked
	}

	return providerInsertError(ctx, err, logger)
}

func providerInsertError(ctx context.Context, err error, logger *slog.Logger) *APIError {
	switch {
	case err == nil:
		return nil
	case sqlIsDuplcateError(err, "user_providers_provider_id_provider_user_id_key"):
		logger.ErrorContext(ctx, "user provider id already in use", logError(err))
		return ErrProviderAccountAlreadyLinked
	default:
		logger.ErrorContext(ctx, "error inserting user provider", logError(err))
		return ErrInternalServerError
	}
}
