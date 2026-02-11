package oauth2

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) GetLoginRequest(
	ctx context.Context,
	requestID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginResponse, *Error) {
	authReq, err := p.db.GetOAuth2AuthRequest(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 auth request not found")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Unknown authorization request",
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		logger.WarnContext(ctx, "OAuth2 auth request expired")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Authorization request expired",
		}
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	return &api.OAuth2LoginResponse{
		RequestId:   authReq.ID,
		ClientId:    client.ClientID,
		ClientName:  client.ClientName,
		Scopes:      authReq.Scopes,
		RedirectUri: authReq.RedirectUri,
	}, nil
}

func (p *Provider) CompleteLogin( //nolint:funlen
	ctx context.Context,
	requestID uuid.UUID,
	userID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginCompleteResponse, *Error) {
	authReq, err := p.db.GetOAuth2AuthRequest(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 auth request not found")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Unknown authorization request",
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		logger.WarnContext(ctx, "OAuth2 auth request expired")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Authorization request expired",
		}
	}

	if authReq.Done {
		logger.WarnContext(ctx, "OAuth2 auth request already completed")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Authorization request already completed",
		}
	}

	_, err = p.db.UpdateOAuth2AuthRequestSetUser(
		ctx,
		sql.UpdateOAuth2AuthRequestSetUserParams{
			ID:     requestID,
			UserID: pgtype.UUID{Bytes: userID, Valid: true},
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error updating OAuth2 auth request", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	code := uuid.NewString()
	codeHash := HashToken(code)
	codeExpiresAt := time.Now().Add(AuthCodeTTL)

	_, err = p.db.InsertOAuth2AuthorizationCode(ctx, sql.InsertOAuth2AuthorizationCodeParams{
		CodeHash:      codeHash,
		AuthRequestID: requestID,
		ExpiresAt:     sql.TimestampTz(codeExpiresAt),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 authorization code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	parsedRedirectURI, parseErr := url.Parse(authReq.RedirectUri)
	if parseErr != nil {
		logger.ErrorContext(ctx, "error parsing redirect URI", logError(parseErr))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	q := parsedRedirectURI.Query()
	q.Set("code", code)
	q.Set("iss", p.signer.Issuer())

	if authReq.State.Valid && authReq.State.String != "" {
		q.Set("state", authReq.State.String)
	}

	parsedRedirectURI.RawQuery = q.Encode()

	return &api.OAuth2LoginCompleteResponse{
		RedirectUri: parsedRedirectURI.String(),
	}, nil
}
