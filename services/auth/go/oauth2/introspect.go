package oauth2

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) IntrospectToken( //nolint:cyclop
	ctx context.Context,
	req *api.OAuth2IntrospectRequest,
	logger *slog.Logger,
) (*api.OAuth2IntrospectResponse, *Error) {
	inactive := &api.OAuth2IntrospectResponse{Active: false} //nolint:exhaustruct

	if req.ClientId == nil || *req.ClientId == "" {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID is required",
		}
	}

	if oauthErr := p.authenticateClient(
		ctx, *req.ClientId, req.ClientId, req.ClientSecret, logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	hint := ""
	if req.TokenTypeHint != nil {
		hint = string(*req.TokenTypeHint)
	}

	if hint == "" || hint == TokenTypeRefreshToken {
		tokenHash := HashToken(req.Token)

		rt, err := p.db.GetOAuth2RefreshTokenByHash(ctx, tokenHash)
		if err == nil && rt.ExpiresAt.Time.After(time.Now()) {
			scope := strings.Join(rt.Scopes, " ")
			sub := rt.UserID.String()
			exp := int(rt.ExpiresAt.Time.Unix())
			iat := int(rt.CreatedAt.Time.Unix())
			tokenType := TokenTypeRefreshToken

			return &api.OAuth2IntrospectResponse{ //nolint:exhaustruct
				Active:    true,
				ClientId:  &rt.ClientID,
				Sub:       &sub,
				Scope:     &scope,
				Exp:       &exp,
				Iat:       &iat,
				TokenType: &tokenType,
			}, nil
		}

		if hint == TokenTypeRefreshToken {
			return inactive, nil
		}
	}

	sub, iatTime, expTime, iss, err := p.signer.ValidateToken(req.Token)
	if err != nil {
		return inactive, nil
	}

	exp := int(expTime.Unix())
	iat := int(iatTime.Unix())
	tokenType := "access_token"

	return &api.OAuth2IntrospectResponse{ //nolint:exhaustruct
		Active:    true,
		Sub:       &sub,
		Exp:       &exp,
		Iat:       &iat,
		Iss:       &iss,
		TokenType: &tokenType,
	}, nil
}
