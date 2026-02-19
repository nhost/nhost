package oauth2

import (
	"context"
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) RevokeToken(
	ctx context.Context,
	req *api.OAuth2RevokeRequest,
	logger *slog.Logger,
) *Error {
	if req.ClientId == nil || *req.ClientId == "" {
		return &Error{
			Err:         "invalid_client",
			Description: "Client ID is required",
		}
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, *req.ClientId)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if oauthErr := p.authenticateClient(
		client, req.ClientId, req.ClientSecret,
	); oauthErr != nil {
		return oauthErr
	}

	tokenHash := HashToken(req.Token)

	if err := p.db.DeleteOAuth2RefreshTokenByHashAndClientID(
		ctx, sql.DeleteOAuth2RefreshTokenByHashAndClientIDParams{
			TokenHash: tokenHash,
			ClientID:  *req.ClientId,
		},
	); err != nil {
		logger.ErrorContext(ctx, "error revoking OAuth2 token", logError(err))
	}

	return nil
}
