package oauth2

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v4"
	josejwt "github.com/go-jose/go-jose/v4/jwt"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func (p *Provider) ExchangeCode( //nolint:cyclop
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	if req.Code == nil || *req.Code == "" {
		return nil, &Error{Err: "invalid_request", Description: "Missing code"}
	}

	codeHash := HashToken(*req.Code)

	authReq, err := p.db.GetOAuth2AuthRequestByCodeHash(ctx, codeHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 authorization code not found")
		return nil, &Error{Err: "invalid_grant", Description: "Invalid authorization code"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request by code hash", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if err := p.db.DeleteOAuth2AuthorizationCode(ctx, codeHash); err != nil {
		logger.ErrorContext(ctx, "error deleting OAuth2 authorization code", logError(err))
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		return nil, &Error{Err: "invalid_grant", Description: "Authorization code expired"}
	}

	if !authReq.UserID.Valid {
		return nil, &Error{
			Err: "invalid_grant", Description: "Authorization not completed",
		}
	}

	if req.RedirectUri != nil && *req.RedirectUri != authReq.RedirectUri {
		return nil, &Error{Err: "invalid_grant", Description: "redirect_uri mismatch"}
	}

	if oauthErr := ValidatePKCE(authReq, req.CodeVerifier); oauthErr != nil {
		return nil, oauthErr
	}

	if oauthErr := p.authenticateClient(
		ctx,
		authReq.ClientID,
		req.ClientId,
		req.ClientSecret,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	userID := uuid.UUID(authReq.UserID.Bytes)

	return p.issueTokens(ctx, userID, authReq, logger)
}

func (p *Provider) RefreshToken( //nolint:cyclop,funlen
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	if req.RefreshToken == nil || *req.RefreshToken == "" {
		return nil, &Error{Err: "invalid_request", Description: "Missing refresh_token"}
	}

	tokenHash := HashToken(*req.RefreshToken)

	rt, err := p.db.GetOAuth2RefreshTokenByHash(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 refresh token not found")
		return nil, &Error{Err: "invalid_grant", Description: "Invalid refresh token"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 refresh token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if rt.ExpiresAt.Time.Before(time.Now()) {
		return nil, &Error{Err: "invalid_grant", Description: "Refresh token expired"}
	}

	if err := p.db.DeleteOAuth2RefreshToken(ctx, tokenHash); err != nil {
		logger.ErrorContext(ctx, "error deleting old OAuth2 refresh token", logError(err))
	}

	if oauthErr := p.authenticateClient(
		ctx,
		rt.ClientID,
		req.ClientId,
		req.ClientSecret,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, rt.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	accessTokenTTL := time.Duration(p.config.AccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(p.config.RefreshTokenTTL) * time.Second

	if client.AccessTokenLifetime > 0 {
		accessTokenTTL = time.Duration(client.AccessTokenLifetime) * time.Second
	}

	if client.RefreshTokenLifetime > 0 {
		refreshTokenTTL = time.Duration(client.RefreshTokenLifetime) * time.Second
	}

	accessToken, err := p.createAccessToken(
		ctx, rt.UserID, rt.ClientID, rt.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating OAuth2 access token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	newRefreshToken := uuid.NewString()
	newTokenHash := HashToken(newRefreshToken)

	_, err = p.db.InsertOAuth2RefreshToken(ctx, sql.InsertOAuth2RefreshTokenParams{
		TokenHash:     newTokenHash,
		AuthRequestID: rt.AuthRequestID,
		ClientID:      rt.ClientID,
		UserID:        rt.UserID,
		Scopes:        rt.Scopes,
		ExpiresAt:     sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting new OAuth2 refresh token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	scope := strings.Join(rt.Scopes, " ")

	resp := &api.OAuth2TokenResponse{ //nolint:exhaustruct
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(accessTokenTTL.Seconds()),
		RefreshToken: &newRefreshToken,
		Scope:        &scope,
	}

	if slices.Contains(rt.Scopes, "openid") {
		idToken, err := p.createIDToken(
			ctx,
			rt.UserID,
			rt.ClientID,
			authReqNonce(nil),
			rt.Scopes,
			accessTokenTTL,
			logger,
		)
		if err != nil {
			logger.ErrorContext(ctx, "error creating ID token", logError(err))
		} else {
			resp.IdToken = &idToken
		}
	}

	return resp, nil
}

func (p *Provider) issueTokens( //nolint:funlen
	ctx context.Context,
	userID uuid.UUID,
	authReq sql.AuthOauth2AuthRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	client, err := p.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	accessTokenTTL := time.Duration(p.config.AccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(p.config.RefreshTokenTTL) * time.Second

	if client.AccessTokenLifetime > 0 {
		accessTokenTTL = time.Duration(client.AccessTokenLifetime) * time.Second
	}

	if client.RefreshTokenLifetime > 0 {
		refreshTokenTTL = time.Duration(client.RefreshTokenLifetime) * time.Second
	}

	accessToken, err := p.createAccessToken(
		ctx, userID, authReq.ClientID, authReq.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating access token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	refreshToken := uuid.NewString()
	refreshTokenHash := HashToken(refreshToken)

	_, err = p.db.InsertOAuth2RefreshToken(ctx, sql.InsertOAuth2RefreshTokenParams{
		TokenHash:     refreshTokenHash,
		AuthRequestID: pgtype.UUID{Bytes: authReq.ID, Valid: true},
		ClientID:      authReq.ClientID,
		UserID:        userID,
		Scopes:        authReq.Scopes,
		ExpiresAt:     sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 refresh token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	scope := strings.Join(authReq.Scopes, " ")

	resp := &api.OAuth2TokenResponse{ //nolint:exhaustruct
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(accessTokenTTL.Seconds()),
		RefreshToken: &refreshToken,
		Scope:        &scope,
	}

	if slices.Contains(authReq.Scopes, "openid") {
		nonce := authReqNonce(&authReq)

		idToken, err := p.createIDToken(
			ctx,
			userID,
			authReq.ClientID,
			nonce,
			authReq.Scopes,
			accessTokenTTL,
			logger,
		)
		if err != nil {
			logger.ErrorContext(ctx, "error creating ID token", logError(err))
		} else {
			resp.IdToken = &idToken
		}
	}

	return resp, nil
}

func (p *Provider) createAccessToken(
	ctx context.Context,
	userID uuid.UUID,
	clientID string,
	scopes []string,
	ttl time.Duration,
	_ *slog.Logger,
) (string, error) {
	privateKey, keyID, err := p.signer.RSASigningKey()
	if err != nil {
		return "", fmt.Errorf("error getting signing key: %w", err)
	}

	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: privateKey},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", keyID), //nolint:exhaustruct
	)
	if err != nil {
		return "", fmt.Errorf("error creating signer: %w", err)
	}

	now := time.Now()

	user, err := p.db.GetUser(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("error getting user: %w", err)
	}

	userRoles, err := p.db.GetUserRoles(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("error getting user roles: %w", err)
	}

	allowedRoles := make([]string, 0, len(userRoles))
	for _, role := range userRoles {
		allowedRoles = append(allowedRoles, role.Role)
	}

	if !slices.Contains(allowedRoles, user.DefaultRole) {
		allowedRoles = append(allowedRoles, user.DefaultRole)
	}

	claims := map[string]any{
		"iss":   p.Issuer(),
		"sub":   userID.String(),
		"aud":   clientID,
		"iat":   now.Unix(),
		"exp":   now.Add(ttl).Unix(),
		"scope": strings.Join(scopes, " "),
		"https://hasura.io/jwt/claims": map[string]any{
			"x-hasura-allowed-roles": allowedRoles,
			"x-hasura-default-role":  user.DefaultRole,
			"x-hasura-user-id":       userID.String(),
		},
	}

	raw, err := josejwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("error serializing access token: %w", err)
	}

	return raw, nil
}

func (p *Provider) createIDToken(
	ctx context.Context,
	userID uuid.UUID,
	clientID string,
	nonce string,
	scopes []string,
	ttl time.Duration,
	_ *slog.Logger,
) (string, error) {
	privateKey, keyID, err := p.signer.RSASigningKey()
	if err != nil {
		return "", fmt.Errorf("error getting signing key: %w", err)
	}

	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: privateKey},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", keyID), //nolint:exhaustruct
	)
	if err != nil {
		return "", fmt.Errorf("error creating signer: %w", err)
	}

	now := time.Now()

	claims := map[string]any{
		"iss":       p.Issuer(),
		"sub":       userID.String(),
		"aud":       clientID,
		"iat":       now.Unix(),
		"exp":       now.Add(ttl).Unix(),
		"auth_time": now.Unix(),
	}

	if nonce != "" {
		claims["nonce"] = nonce
	}

	if err := p.addScopedIDTokenClaims(ctx, claims, scopes, userID); err != nil {
		return "", err
	}

	raw, err := josejwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("error serializing id token: %w", err)
	}

	return raw, nil
}

func (p *Provider) authenticateClient(
	ctx context.Context,
	expectedClientID string,
	reqClientID *string,
	reqClientSecret *string,
	logger *slog.Logger,
) *Error {
	if reqClientID != nil && *reqClientID != expectedClientID {
		return &Error{Err: "invalid_client", Description: "Client ID mismatch"}
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, expectedClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client for auth", logError(err))
		return &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if client.IsPublic {
		return nil
	}

	if reqClientSecret == nil || *reqClientSecret == "" {
		return &Error{Err: "invalid_client", Description: "Client secret required"}
	}

	if !p.hasher.Verify(*reqClientSecret, client.ClientSecretHash.String) {
		return &Error{Err: "invalid_client", Description: "Invalid client credentials"}
	}

	return nil
}

func logError(err error) slog.Attr {
	return slog.String("error", err.Error())
}
