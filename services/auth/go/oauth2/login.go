package oauth2

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) getAndValidateAuthRequest(
	ctx context.Context,
	requestID uuid.UUID,
	logger *slog.Logger,
) (sql.AuthOauth2AuthRequest, *Error) {
	authReq, err := p.db.GetOAuth2AuthRequest(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 auth request not found")

		return authReq, &Error{
			Err:         "invalid_request",
			Description: "Unknown authorization request",
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request", logError(err))
		return authReq, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		logger.WarnContext(ctx, "OAuth2 auth request expired")

		return authReq, &Error{
			Err:         "invalid_request",
			Description: "Authorization request expired",
		}
	}

	return authReq, nil
}

func (p *Provider) GetLoginRequest(
	ctx context.Context,
	requestID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginResponse, *Error) {
	authReq, oauthErr := p.getAndValidateAuthRequest(ctx, requestID, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	return &api.OAuth2LoginResponse{
		RequestId:   authReq.ID,
		ClientId:    client.ClientID,
		Scopes:      authReq.Scopes,
		RedirectUri: authReq.RedirectUri,
	}, nil
}

func (p *Provider) CompleteLogin(
	ctx context.Context,
	requestID uuid.UUID,
	userID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginCompleteResponse, *Error) {
	authReq, oauthErr := p.getAndValidateAuthRequest(ctx, requestID, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	if authReq.Done {
		logger.WarnContext(ctx, "OAuth2 auth request already completed")

		return nil, &Error{
			Err:         "invalid_request",
			Description: "Authorization request already completed",
		}
	}

	code := uuid.NewString()
	codeHash := HashToken(code)
	codeExpiresAt := time.Now().Add(AuthCodeTTL)

	_, err := p.db.CompleteOAuth2LoginAndInsertCode(
		ctx,
		sql.CompleteOAuth2LoginAndInsertCodeParams{
			ID:        sql.UUID(requestID),
			UserID:    sql.UUID(userID),
			CodeHash:  sql.Text(codeHash),
			ExpiresAt: sql.TimestampTz(codeExpiresAt),
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error completing OAuth2 login", logError(err))
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
