package oauth2

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

	client, err := p.db.GetOAuth2ClientByClientID(ctx, *req.ClientId)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if oauthErr := p.authenticateClient(
		client, req.ClientId, req.ClientSecret,
	); oauthErr != nil {
		return nil, oauthErr
	}

	hint := ""
	if req.TokenTypeHint != nil {
		hint = string(*req.TokenTypeHint)
	}

	if hint == "" || hint == TokenTypeRefreshToken {
		if resp := p.introspectRefreshToken(ctx, req.Token, *req.ClientId); resp != nil {
			return resp, nil
		}

		if hint == TokenTypeRefreshToken {
			return inactive, nil
		}
	}

	if resp := p.introspectAccessToken(req.Token, *req.ClientId); resp != nil {
		return resp, nil
	}

	return inactive, nil
}

func (p *Provider) introspectRefreshToken(
	ctx context.Context,
	token string,
	clientID string,
) *api.OAuth2IntrospectResponse {
	tokenHash := HashToken(token)

	rt, err := p.db.GetOAuth2RefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		return nil
	}

	if rt.ExpiresAt.Time.Before(time.Now()) || rt.ClientID != clientID {
		return nil
	}

	scope := strings.Join(rt.Scopes, " ")
	sub := rt.UserID.String()
	exp := int(rt.ExpiresAt.Time.Unix())
	iat := int(rt.CreatedAt.Time.Unix())
	tokenType := TokenTypeRefreshToken
	iss := p.signer.Issuer()

	return &api.OAuth2IntrospectResponse{
		Active:    true,
		ClientId:  &rt.ClientID,
		Sub:       &sub,
		Scope:     &scope,
		Exp:       &exp,
		Iat:       &iat,
		Iss:       &iss,
		TokenType: &tokenType,
	}
}

func (p *Provider) introspectAccessToken(
	token string,
	clientID string,
) *api.OAuth2IntrospectResponse {
	jwtToken, err := p.signer.Validate(token)
	if err != nil {
		return nil
	}

	claims, err := extractValidatedClaims(jwtToken)
	if err != nil {
		return nil
	}

	if !slices.Contains(claims.Aud, clientID) {
		return nil
	}

	exp := int(claims.Exp.Unix())
	iat := int(claims.Iat.Unix())
	tokenType := "access_token"

	var clientIDPtr *string
	if len(claims.Aud) > 0 {
		clientIDPtr = &claims.Aud[0]
	}

	var scopePtr *string
	if claims.Scope != "" {
		scopePtr = &claims.Scope
	}

	return &api.OAuth2IntrospectResponse{
		Active:    true,
		ClientId:  clientIDPtr,
		Sub:       &claims.Sub,
		Scope:     scopePtr,
		Exp:       &exp,
		Iat:       &iat,
		Iss:       &claims.Iss,
		TokenType: &tokenType,
	}
}

func extractValidatedClaims(token *jwt.Token) (*ValidatedClaims, error) { //nolint:cyclop
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("unexpected claims type") //nolint:err113
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return nil, fmt.Errorf("error getting subject: %w", err)
	}

	iss, err := claims.GetIssuer()
	if err != nil {
		return nil, fmt.Errorf("error getting issuer: %w", err)
	}

	aud, err := claims.GetAudience()
	if err != nil {
		return nil, fmt.Errorf("error getting audience: %w", err)
	}

	expTime, err := claims.GetExpirationTime()
	if err != nil {
		return nil, fmt.Errorf("error getting expiration time: %w", err)
	}

	var exp time.Time
	if expTime != nil {
		exp = expTime.Time
	}

	iatTime, err := claims.GetIssuedAt()
	if err != nil {
		return nil, fmt.Errorf("error getting issued at: %w", err)
	}

	var iat time.Time
	if iatTime != nil {
		iat = iatTime.Time
	}

	scope, ok := claims["scope"].(string)
	if !ok && claims["scope"] != nil {
		return nil, fmt.Errorf( //nolint:err113
			"error getting scope: unexpected type %T", claims["scope"],
		)
	}

	return &ValidatedClaims{
		Sub:   sub,
		Aud:   aud,
		Scope: scope,
		Iat:   iat,
		Exp:   exp,
		Iss:   iss,
	}, nil
}
