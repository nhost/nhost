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
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

// ValidatedCodeExchange holds the validated state of an authorization code
// exchange, ready for token issuance.
type ValidatedCodeExchange struct {
	UserID   uuid.UUID
	CodeHash string
	AuthReq  sql.AuthOauth2AuthRequest
}

func (p *Provider) ValidateCodeExchange( //nolint:cyclop
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*ValidatedCodeExchange, *Error) {
	if req.Code == nil || *req.Code == "" {
		return nil, &Error{Err: "invalid_request", Description: "Missing code"}
	}

	codeHash := HashToken(*req.Code)

	authReq, err := p.db.GetOAuth2AuthorizationCodeAuthRequest(ctx, codeHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 authorization code not found or expired")
		return nil, &Error{Err: "invalid_grant", Description: "Invalid authorization code"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 authorization code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if !authReq.UserID.Valid {
		return nil, &Error{
			Err: "invalid_grant", Description: "Authorization not completed",
		}
	}

	switch {
	case authReq.RedirectUri != "":
		if req.RedirectUri == nil || *req.RedirectUri != authReq.RedirectUri {
			return nil, &Error{Err: "invalid_grant", Description: "redirect_uri mismatch"}
		}
	default:
		if req.RedirectUri != nil {
			return nil, &Error{Err: "invalid_request", Description: "redirect_uri not expected"}
		}
	}

	client, err := p.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if oauthErr := ValidatePKCE(
		authReq, req.CodeVerifier, !client.ClientSecretHash.Valid,
	); oauthErr != nil {
		return nil, oauthErr
	}

	if oauthErr := p.authenticateClient(
		client, req.ClientId, req.ClientSecret,
	); oauthErr != nil {
		return nil, oauthErr
	}

	userID := uuid.UUID(authReq.UserID.Bytes)

	return &ValidatedCodeExchange{
		UserID:   userID,
		CodeHash: codeHash,
		AuthReq:  authReq,
	}, nil
}

func (p *Provider) IssueTokensFromCode(
	ctx context.Context,
	validated *ValidatedCodeExchange,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	return p.issueTokens(ctx, validated.CodeHash, validated.UserID, validated.AuthReq, logger)
}

// ValidatedRefreshGrant holds the validated state of a refresh token grant,
// ready for token issuance.
type ValidatedRefreshGrant struct {
	UserID       uuid.UUID
	TokenHash    string
	RefreshToken sql.AuthOauth2RefreshToken
}

func (p *Provider) ValidateRefreshGrant(
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*ValidatedRefreshGrant, *Error) {
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

	client, err := p.db.GetOAuth2ClientByClientID(ctx, rt.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if oauthErr := p.authenticateClient(
		client, req.ClientId, req.ClientSecret,
	); oauthErr != nil {
		return nil, oauthErr
	}

	return &ValidatedRefreshGrant{
		UserID:       rt.UserID,
		TokenHash:    tokenHash,
		RefreshToken: rt,
	}, nil
}

func (p *Provider) IssueTokensFromRefresh( //nolint:funlen
	ctx context.Context,
	validated *ValidatedRefreshGrant,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	rt := validated.RefreshToken

	accessTokenTTL := time.Duration(p.config.AccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(p.config.RefreshTokenTTL) * time.Second

	accessToken, err := p.createAccessToken(
		ctx, rt.UserID, rt.ClientID, rt.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating OAuth2 access token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	newRefreshToken := uuid.NewString()
	newTokenHash := HashToken(newRefreshToken)

	_, err = p.db.UpdateOAuth2RefreshToken(ctx, sql.UpdateOAuth2RefreshTokenParams{
		TokenHash:   validated.TokenHash,
		TokenHash_2: newTokenHash,
		ExpiresAt:   sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 refresh token already consumed")
		return nil, &Error{Err: "invalid_grant", Description: "Invalid refresh token"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error rotating OAuth2 refresh token", logError(err))
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
		authTime := p.resolveAuthTime(ctx, rt.AuthRequestID)

		idToken, err := p.createIDToken(
			ctx,
			rt.UserID,
			rt.ClientID,
			authReqNonce(nil),
			rt.Scopes,
			accessTokenTTL,
			accessToken,
			authTime,
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
	codeHash string,
	userID uuid.UUID,
	authReq sql.AuthOauth2AuthRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	accessTokenTTL := time.Duration(p.config.AccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(p.config.RefreshTokenTTL) * time.Second

	accessToken, err := p.createAccessToken(
		ctx, userID, authReq.ClientID, authReq.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating access token", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	refreshToken := uuid.NewString()
	refreshTokenHash := HashToken(refreshToken)

	_, err = p.db.ConsumeOAuth2CodeAndInsertRefreshToken(
		ctx,
		sql.ConsumeOAuth2CodeAndInsertRefreshTokenParams{
			CodeHash:  codeHash,
			TokenHash: refreshTokenHash,
			ClientID:  authReq.ClientID,
			UserID:    userID,
			Scopes:    authReq.Scopes,
			ExpiresAt: sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 authorization code already consumed")
		return nil, &Error{Err: "invalid_grant", Description: "Invalid authorization code"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error consuming code and inserting refresh token", logError(err))
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
			accessToken,
			authReq.AuthTime.Time,
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
	logger *slog.Logger,
) (string, error) {
	claims := jwt.MapClaims{
		"sub":   userID.String(),
		"aud":   clientID,
		"scope": strings.Join(scopes, " "),
	}

	if slices.Contains(scopes, "graphql") {
		user, err := p.db.GetUser(ctx, userID)
		if err != nil {
			return "", fmt.Errorf("error getting user: %w", err)
		}

		roles, err := p.resolveUserGraphQLRoles(ctx, user, userID)
		if err != nil {
			return "", fmt.Errorf("error resolving user roles: %w", err)
		}

		ns, c, err := p.signer.GraphQLClaims(
			ctx, userID, roles.IsAnonymous, roles.AllowedRoles, roles.DefaultRole, nil, logger,
		)
		if err != nil {
			return "", fmt.Errorf("error creating GraphQL claims: %w", err)
		}

		claims[ns] = c
	}

	exp := time.Now().Add(ttl)

	raw, err := p.signer.SignTokenWithClaims(claims, exp)
	if err != nil {
		return "", fmt.Errorf("error signing access token: %w", err)
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
	accessToken string,
	authTime time.Time,
	_ *slog.Logger,
) (string, error) {
	now := time.Now()

	claims := jwt.MapClaims{
		"sub":       userID.String(),
		"aud":       clientID,
		"auth_time": authTime.Unix(),
	}

	if nonce != "" {
		claims["nonce"] = nonce
	}

	if accessToken != "" {
		claims["at_hash"] = computeAtHash(accessToken)
	}

	if err := p.addScopedIDTokenClaims(ctx, claims, scopes, userID); err != nil {
		return "", err
	}

	exp := now.Add(ttl)

	raw, err := p.signer.SignTokenWithClaims(claims, exp)
	if err != nil {
		return "", fmt.Errorf("error signing id token: %w", err)
	}

	return raw, nil
}

func (p *Provider) resolveAuthTime(
	ctx context.Context, authRequestID pgtype.UUID,
) time.Time {
	if authRequestID.Valid {
		authReq, err := p.db.GetOAuth2AuthRequest(
			ctx, uuid.UUID(authRequestID.Bytes),
		)
		if err == nil && authReq.AuthTime.Valid {
			return authReq.AuthTime.Time
		}
	}

	return time.Now()
}

func (p *Provider) authenticateClient(
	client sql.AuthOauth2Client,
	reqClientID *string,
	reqClientSecret *string,
) *Error {
	if reqClientID != nil && *reqClientID != client.ClientID {
		return &Error{Err: "invalid_client", Description: "Client ID mismatch"}
	}

	if !client.ClientSecretHash.Valid {
		if reqClientID == nil {
			return &Error{Err: "invalid_client", Description: "Client ID is required"}
		}

		return nil
	}

	if reqClientSecret == nil || *reqClientSecret == "" {
		return &Error{Err: "invalid_client", Description: "Client secret required"}
	}

	if !p.verifySecret(*reqClientSecret, client.ClientSecretHash.String) {
		return &Error{Err: "invalid_client", Description: "Invalid client credentials"}
	}

	return nil
}

// userGraphQLRolesParams holds the resolved role information needed to build
// GraphQL claims for a user.
type userGraphQLRolesParams struct {
	IsAnonymous  bool
	AllowedRoles []string
	DefaultRole  string
}

// resolveUserGraphQLRoles fetches the user's roles and ensures the default role
// is included in the allowed set.
func (p *Provider) resolveUserGraphQLRoles(
	ctx context.Context,
	user sql.AuthUser,
	userID uuid.UUID,
) (*userGraphQLRolesParams, error) {
	userRoles, err := p.db.GetUserRoles(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("error getting user roles: %w", err)
	}

	allowedRoles := make([]string, 0, len(userRoles))
	for _, role := range userRoles {
		allowedRoles = append(allowedRoles, role.Role)
	}

	if !slices.Contains(allowedRoles, user.DefaultRole) {
		allowedRoles = append(allowedRoles, user.DefaultRole)
	}

	return &userGraphQLRolesParams{
		IsAnonymous:  user.IsAnonymous,
		AllowedRoles: allowedRoles,
		DefaultRole:  user.DefaultRole,
	}, nil
}

func logError(err error) slog.Attr {
	return slog.String("error", err.Error())
}
