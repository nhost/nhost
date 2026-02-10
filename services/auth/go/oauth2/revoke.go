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
) {
	tokenHash := HashToken(req.Token)

	if err := p.db.DeleteOAuth2RefreshToken(ctx, tokenHash); err != nil {
		logger.ErrorContext(ctx, "error revoking OAuth2 token", logError(err))
	}
}
