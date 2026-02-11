package oauth2

import (
	"context"
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/api"
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

	if oauthErr := p.authenticateClient(
		ctx, *req.ClientId, req.ClientId, req.ClientSecret, logger,
	); oauthErr != nil {
		return oauthErr
	}

	tokenHash := HashToken(req.Token)

	if err := p.db.DeleteOAuth2RefreshToken(ctx, tokenHash); err != nil {
		logger.ErrorContext(ctx, "error revoking OAuth2 token", logError(err))
	}

	return nil
}
