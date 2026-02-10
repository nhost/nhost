package oauth2

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4"
	josejwt "github.com/go-jose/go-jose/v4/jwt"
	"github.com/nhost/nhost/services/auth/go/api"
)

func (p *Provider) IntrospectToken( //nolint:cyclop,funlen
	ctx context.Context,
	req *api.OAuth2IntrospectRequest,
	logger *slog.Logger,
) *api.OAuth2IntrospectResponse {
	inactive := &api.OAuth2IntrospectResponse{Active: false} //nolint:exhaustruct

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
			}
		}

		if hint == TokenTypeRefreshToken {
			return inactive
		}
	}

	privateKey, _, err := p.signer.RSASigningKey()
	if err != nil {
		logger.ErrorContext(ctx, "error getting signing key for introspection", logError(err))
		return inactive
	}

	pubKey := &privateKey.PublicKey

	tok, err := josejwt.ParseSigned(
		req.Token, []jose.SignatureAlgorithm{jose.RS256},
	)
	if err != nil {
		return inactive
	}

	claims := josejwt.Claims{} //nolint:exhaustruct
	if err := tok.Claims(pubKey, &claims); err != nil {
		return inactive
	}

	if err := claims.ValidateWithLeeway(josejwt.Expected{ //nolint:exhaustruct
		Issuer: p.Issuer(),
	}, 0); err != nil {
		return inactive
	}

	sub := claims.Subject
	exp := int(claims.Expiry.Time().Unix())
	iat := int(claims.IssuedAt.Time().Unix())
	iss := claims.Issuer
	tokenType := "access_token"

	return &api.OAuth2IntrospectResponse{ //nolint:exhaustruct
		Active:    true,
		Sub:       &sub,
		Exp:       &exp,
		Iat:       &iat,
		Iss:       &iss,
		TokenType: &tokenType,
	}
}
