package controller

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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
	oidcprovider "github.com/nhost/nhost/services/auth/go/oidc/provider"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	oauth2AuthMethodClientSecretPost = "client_secret_post"
	oauth2AuthMethodNone             = "none"
	oauth2TokenTypeRefreshToken      = "refresh_token"
	oauth2AuthRequestTTL             = 10 * time.Minute
	oauth2AuthCodeTTL                = 5 * time.Minute
)

func hashOAuth2Token(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func (wf *Workflows) oauth2ValidateAuthorizeRequest( //nolint:cyclop,funlen
	ctx context.Context,
	config *Config,
	params api.Oauth2AuthorizeParams,
	logger *slog.Logger,
) (*api.OAuth2LoginResponse, string, *OAuth2Error) {
	client, err := wf.db.GetOAuth2ClientByClientID(ctx, params.ClientId)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(
			ctx,
			"OAuth2 client not found",
			slog.String("client_id", params.ClientId),
		)

		return nil, "", &OAuth2Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, "", &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	if !slices.Contains(client.RedirectUris, params.RedirectUri) {
		logger.WarnContext(
			ctx,
			"redirect URI not registered",
			slog.String("redirect_uri", params.RedirectUri),
		)

		return nil, "", &OAuth2Error{
			Err:         "invalid_request",
			Description: "Invalid redirect_uri",
		}
	}

	if string(params.ResponseType) != "code" {
		return nil, "", &OAuth2Error{
			Err:         "unsupported_response_type",
			Description: "Only response_type=code is supported",
		}
	}

	requestedScopes := []string{"openid"}
	if params.Scope != nil && *params.Scope != "" {
		requestedScopes = strings.Split(*params.Scope, " ")
	}

	for _, s := range requestedScopes {
		if !slices.Contains(client.Scopes, s) {
			return nil, "", &OAuth2Error{
				Err:         "invalid_scope",
				Description: fmt.Sprintf("Scope %q not allowed for this client", s),
			}
		}
	}

	expiresAt := time.Now().Add(oauth2AuthRequestTTL)

	authReq, err := wf.db.InsertOAuth2AuthRequest(ctx, sql.InsertOAuth2AuthRequestParams{
		ClientID:            params.ClientId,
		Scopes:              requestedScopes,
		RedirectUri:         params.RedirectUri,
		State:               pgText(params.State),
		Nonce:               pgText(params.Nonce),
		ResponseType:        string(params.ResponseType),
		CodeChallenge:       pgText(params.CodeChallenge),
		CodeChallengeMethod: pgTextFromCodeChallengeMethod(params.CodeChallengeMethod),
		Resource:            pgText(params.Resource),
		ExpiresAt:           sql.TimestampTz(expiresAt),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 auth request", logError(err))
		return nil, "", &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	loginURL := config.OAuth2ProviderLoginURL
	if loginURL == "" {
		loginURL = config.ClientURL.String() + "/oauth2/login"
	}

	loginResp := &api.OAuth2LoginResponse{
		RequestId:   authReq.ID,
		ClientId:    client.ClientID,
		ClientName:  client.ClientName,
		Scopes:      requestedScopes,
		RedirectUri: params.RedirectUri,
	}

	redirectURL := fmt.Sprintf("%s?request_id=%s", loginURL, authReq.ID.String())

	return loginResp, redirectURL, nil
}

func (wf *Workflows) oauth2GetLoginRequest(
	ctx context.Context,
	requestID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginResponse, *OAuth2Error) {
	authReq, err := wf.db.GetOAuth2AuthRequest(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 auth request not found")

		return nil, &OAuth2Error{
			Err:         "invalid_request",
			Description: "Unknown authorization request",
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		logger.WarnContext(ctx, "OAuth2 auth request expired")

		return nil, &OAuth2Error{
			Err:         "invalid_request",
			Description: "Authorization request expired",
		}
	}

	client, err := wf.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	return &api.OAuth2LoginResponse{
		RequestId:   authReq.ID,
		ClientId:    client.ClientID,
		ClientName:  client.ClientName,
		Scopes:      authReq.Scopes,
		RedirectUri: authReq.RedirectUri,
	}, nil
}

func (wf *Workflows) oauth2CompleteLogin( //nolint:funlen
	ctx context.Context,
	requestID uuid.UUID,
	userID uuid.UUID,
	logger *slog.Logger,
) (*api.OAuth2LoginCompleteResponse, *OAuth2Error) {
	authReq, err := wf.db.GetOAuth2AuthRequest(ctx, requestID)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 auth request not found")

		return nil, &OAuth2Error{
			Err:         "invalid_request",
			Description: "Unknown authorization request",
		}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		logger.WarnContext(ctx, "OAuth2 auth request expired")

		return nil, &OAuth2Error{
			Err:         "invalid_request",
			Description: "Authorization request expired",
		}
	}

	if authReq.Done {
		logger.WarnContext(ctx, "OAuth2 auth request already completed")

		return nil, &OAuth2Error{
			Err:         "invalid_request",
			Description: "Authorization request already completed",
		}
	}

	_, err = wf.db.UpdateOAuth2AuthRequestSetUser(
		ctx,
		sql.UpdateOAuth2AuthRequestSetUserParams{
			ID:     requestID,
			UserID: pgtype.UUID{Bytes: userID, Valid: true},
		},
	)
	if err != nil {
		logger.ErrorContext(ctx, "error updating OAuth2 auth request", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	code := uuid.NewString()
	codeHash := hashOAuth2Token(code)
	codeExpiresAt := time.Now().Add(oauth2AuthCodeTTL)

	_, err = wf.db.InsertOAuth2AuthorizationCode(ctx, sql.InsertOAuth2AuthorizationCodeParams{
		CodeHash:      codeHash,
		AuthRequestID: requestID,
		ExpiresAt:     sql.TimestampTz(codeExpiresAt),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 authorization code", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	redirectURI := authReq.RedirectUri + "?code=" + code
	if authReq.State.Valid && authReq.State.String != "" {
		redirectURI += "&state=" + authReq.State.String
	}

	return &api.OAuth2LoginCompleteResponse{
		RedirectUri: redirectURI,
	}, nil
}

func (wf *Workflows) oauth2ExchangeCode( //nolint:cyclop
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *OAuth2Error) {
	if req.Code == nil || *req.Code == "" {
		return nil, &OAuth2Error{Err: "invalid_request", Description: "Missing code"}
	}

	codeHash := hashOAuth2Token(*req.Code)

	authReq, err := wf.db.GetOAuth2AuthRequestByCodeHash(ctx, codeHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 authorization code not found")
		return nil, &OAuth2Error{Err: "invalid_grant", Description: "Invalid authorization code"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 auth request by code hash", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	if err := wf.db.DeleteOAuth2AuthorizationCode(ctx, codeHash); err != nil {
		logger.ErrorContext(ctx, "error deleting OAuth2 authorization code", logError(err))
	}

	if authReq.ExpiresAt.Time.Before(time.Now()) {
		return nil, &OAuth2Error{Err: "invalid_grant", Description: "Authorization code expired"}
	}

	if !authReq.UserID.Valid {
		return nil, &OAuth2Error{
			Err: "invalid_grant", Description: "Authorization not completed",
		}
	}

	if req.RedirectUri != nil && *req.RedirectUri != authReq.RedirectUri {
		return nil, &OAuth2Error{Err: "invalid_grant", Description: "redirect_uri mismatch"}
	}

	if oauthErr := validatePKCE(authReq, req.CodeVerifier); oauthErr != nil {
		return nil, oauthErr
	}

	if oauthErr := wf.authenticateClient(
		ctx,
		authReq.ClientID,
		req.ClientId,
		req.ClientSecret,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	userID := uuid.UUID(authReq.UserID.Bytes)

	return wf.issueOAuth2Tokens(ctx, config, keyManager, userID, authReq, logger)
}

func (wf *Workflows) oauth2RefreshToken( //nolint:cyclop,funlen
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *OAuth2Error) {
	if req.RefreshToken == nil || *req.RefreshToken == "" {
		return nil, &OAuth2Error{Err: "invalid_request", Description: "Missing refresh_token"}
	}

	tokenHash := hashOAuth2Token(*req.RefreshToken)

	rt, err := wf.db.GetOAuth2RefreshTokenByHash(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 refresh token not found")
		return nil, &OAuth2Error{Err: "invalid_grant", Description: "Invalid refresh token"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 refresh token", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	if rt.ExpiresAt.Time.Before(time.Now()) {
		return nil, &OAuth2Error{Err: "invalid_grant", Description: "Refresh token expired"}
	}

	if err := wf.db.DeleteOAuth2RefreshToken(ctx, tokenHash); err != nil {
		logger.ErrorContext(ctx, "error deleting old OAuth2 refresh token", logError(err))
	}

	if oauthErr := wf.authenticateClient(
		ctx,
		rt.ClientID,
		req.ClientId,
		req.ClientSecret,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	client, err := wf.db.GetOAuth2ClientByClientID(ctx, rt.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	accessTokenTTL := time.Duration(config.OAuth2ProviderAccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(config.OAuth2ProviderRefreshTokenTTL) * time.Second

	if client.AccessTokenLifetime > 0 {
		accessTokenTTL = time.Duration(client.AccessTokenLifetime) * time.Second
	}

	if client.RefreshTokenLifetime > 0 {
		refreshTokenTTL = time.Duration(client.RefreshTokenLifetime) * time.Second
	}

	accessToken, err := wf.createOAuth2AccessToken(
		ctx, config, keyManager, rt.UserID, rt.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating OAuth2 access token", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	newRefreshToken := uuid.NewString()
	newTokenHash := hashOAuth2Token(newRefreshToken)

	_, err = wf.db.InsertOAuth2RefreshToken(ctx, sql.InsertOAuth2RefreshTokenParams{
		TokenHash:     newTokenHash,
		AuthRequestID: rt.AuthRequestID,
		ClientID:      rt.ClientID,
		UserID:        rt.UserID,
		Scopes:        rt.Scopes,
		ExpiresAt:     sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting new OAuth2 refresh token", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
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
		idToken, err := wf.createOAuth2IDToken(
			ctx,
			config,
			keyManager,
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

func (wf *Workflows) oauth2GetUserinfo(
	ctx context.Context,
	_ *Config,
	_ *oidcprovider.KeyManager,
	logger *slog.Logger,
) (*api.OAuth2UserinfoResponse, *OAuth2Error) {
	userID, apiErr := wf.GetJWTInContext(ctx, logger)
	if apiErr != nil {
		return nil, &OAuth2Error{Err: "invalid_token", Description: "Invalid access token"}
	}

	user, err := wf.db.GetUser(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, &OAuth2Error{Err: "invalid_token", Description: "User not found"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting user", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	resp := &api.OAuth2UserinfoResponse{ //nolint:exhaustruct
		Sub: userID.String(),
	}

	if user.Email.Valid {
		resp.Email = &user.Email.String
		resp.EmailVerified = &user.EmailVerified
	}

	if user.DisplayName != "" {
		resp.Name = &user.DisplayName
	}

	if user.AvatarUrl != "" {
		resp.Picture = &user.AvatarUrl
	}

	if user.Locale != "" {
		resp.Locale = &user.Locale
	}

	if user.PhoneNumber.Valid {
		resp.PhoneNumber = &user.PhoneNumber.String
		resp.PhoneNumberVerified = &user.PhoneNumberVerified
	}

	return resp, nil
}

func (wf *Workflows) oauth2RevokeToken(
	ctx context.Context,
	req *api.OAuth2RevokeRequest,
	logger *slog.Logger,
) {
	tokenHash := hashOAuth2Token(req.Token)

	if err := wf.db.DeleteOAuth2RefreshToken(ctx, tokenHash); err != nil {
		logger.ErrorContext(ctx, "error revoking OAuth2 token", logError(err))
	}
}

func (wf *Workflows) oauth2IntrospectToken( //nolint:cyclop,funlen
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	req *api.OAuth2IntrospectRequest,
	logger *slog.Logger,
) *api.OAuth2IntrospectResponse {
	inactive := &api.OAuth2IntrospectResponse{Active: false} //nolint:exhaustruct

	hint := ""
	if req.TokenTypeHint != nil {
		hint = string(*req.TokenTypeHint)
	}

	if hint == "" || hint == oauth2TokenTypeRefreshToken {
		tokenHash := hashOAuth2Token(req.Token)

		rt, err := wf.db.GetOAuth2RefreshTokenByHash(ctx, tokenHash)
		if err == nil && rt.ExpiresAt.Time.After(time.Now()) {
			scope := strings.Join(rt.Scopes, " ")
			sub := rt.UserID.String()
			exp := int(rt.ExpiresAt.Time.Unix())
			iat := int(rt.CreatedAt.Time.Unix())
			tokenType := oauth2TokenTypeRefreshToken

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

		if hint == oauth2TokenTypeRefreshToken {
			return inactive
		}
	}

	privateKey, keyID, err := keyManager.GetSigningKey(ctx)
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
		Issuer: oauth2Issuer(config),
	}, 0); err != nil {
		return inactive
	}

	sub := claims.Subject
	exp := int(claims.Expiry.Time().Unix())
	iat := int(claims.IssuedAt.Time().Unix())
	iss := claims.Issuer
	tokenType := "access_token"

	_ = keyID

	return &api.OAuth2IntrospectResponse{ //nolint:exhaustruct
		Active:    true,
		Sub:       &sub,
		Exp:       &exp,
		Iat:       &iat,
		Iss:       &iss,
		TokenType: &tokenType,
	}
}

func (wf *Workflows) oauth2RegisterClient( //nolint:funlen
	ctx context.Context,
	config *Config,
	req *api.OAuth2RegisterRequest,
	logger *slog.Logger,
) (*api.OAuth2RegisterResponse, *OAuth2Error) {
	if len(req.RedirectUris) == 0 {
		return nil, &OAuth2Error{
			Err:         "invalid_client_metadata",
			Description: "At least one redirect_uri is required",
		}
	}

	grantTypes := []string{"authorization_code"}
	if req.GrantTypes != nil {
		grantTypes = *req.GrantTypes
	}

	responseTypes := []string{"code"}
	if req.ResponseTypes != nil {
		responseTypes = *req.ResponseTypes
	}

	scopes := []string{"openid", "profile", "email"}
	if req.Scope != nil && *req.Scope != "" {
		scopes = strings.Split(*req.Scope, " ")
	}

	authMethod := oauth2AuthMethodClientSecretPost
	if req.TokenEndpointAuthMethod != nil {
		authMethod = string(*req.TokenEndpointAuthMethod)
	}

	isPublic := authMethod == oauth2AuthMethodNone

	clientID := uuid.NewString()

	var clientSecretHash string

	var clientSecretPtr *string

	if !isPublic {
		clientSecret := uuid.NewString() + uuid.NewString()
		clientSecretPtr = &clientSecret

		hash, err := hashPassword(clientSecret)
		if err != nil {
			logger.ErrorContext(ctx, "error hashing client secret", logError(err))
			return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
		}

		clientSecretHash = hash
	}

	accessTokenLifetime := int32(config.OAuth2ProviderAccessTokenTTL)   //nolint:gosec
	refreshTokenLifetime := int32(config.OAuth2ProviderRefreshTokenTTL) //nolint:gosec

	_, err := wf.db.InsertOAuth2Client(ctx, sql.InsertOAuth2ClientParams{
		ClientID:                 clientID,
		ClientSecretHash:         pgTextFromString(clientSecretHash),
		ClientName:               req.ClientName,
		ClientUri:                pgText(req.ClientUri),
		LogoUri:                  pgText(req.LogoUri),
		RedirectUris:             req.RedirectUris,
		GrantTypes:               grantTypes,
		ResponseTypes:            responseTypes,
		Scopes:                   scopes,
		IsPublic:                 isPublic,
		TokenEndpointAuthMethod:  authMethod,
		IDTokenSignedResponseAlg: "RS256",
		AccessTokenLifetime:      accessTokenLifetime,
		RefreshTokenLifetime:     refreshTokenLifetime,
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 client", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	scope := strings.Join(scopes, " ")

	var secretExpiresAt *int
	if clientSecretPtr != nil {
		zero := 0
		secretExpiresAt = &zero
	}

	return &api.OAuth2RegisterResponse{
		ClientId:                clientID,
		ClientSecret:            clientSecretPtr,
		ClientSecretExpiresAt:   secretExpiresAt,
		ClientName:              req.ClientName,
		ClientUri:               req.ClientUri,
		LogoUri:                 req.LogoUri,
		RedirectUris:            req.RedirectUris,
		GrantTypes:              &grantTypes,
		ResponseTypes:           &responseTypes,
		Scope:                   &scope,
		TokenEndpointAuthMethod: &authMethod,
	}, nil
}

func (wf *Workflows) issueOAuth2Tokens( //nolint:funlen
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	userID uuid.UUID,
	authReq sql.AuthOauth2AuthRequest,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *OAuth2Error) {
	client, err := wf.db.GetOAuth2ClientByClientID(ctx, authReq.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	accessTokenTTL := time.Duration(config.OAuth2ProviderAccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(config.OAuth2ProviderRefreshTokenTTL) * time.Second

	if client.AccessTokenLifetime > 0 {
		accessTokenTTL = time.Duration(client.AccessTokenLifetime) * time.Second
	}

	if client.RefreshTokenLifetime > 0 {
		refreshTokenTTL = time.Duration(client.RefreshTokenLifetime) * time.Second
	}

	accessToken, err := wf.createOAuth2AccessToken(
		ctx, config, keyManager, userID, authReq.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating access token", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
	}

	refreshToken := uuid.NewString()
	refreshTokenHash := hashOAuth2Token(refreshToken)

	_, err = wf.db.InsertOAuth2RefreshToken(ctx, sql.InsertOAuth2RefreshTokenParams{
		TokenHash:     refreshTokenHash,
		AuthRequestID: pgtype.UUID{Bytes: authReq.ID, Valid: true},
		ClientID:      authReq.ClientID,
		UserID:        userID,
		Scopes:        authReq.Scopes,
		ExpiresAt:     sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting OAuth2 refresh token", logError(err))
		return nil, &OAuth2Error{Err: "server_error", Description: "Internal server error"}
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

		idToken, err := wf.createOAuth2IDToken(
			ctx,
			config,
			keyManager,
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

func (wf *Workflows) createOAuth2AccessToken(
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	userID uuid.UUID,
	scopes []string,
	ttl time.Duration,
	_ *slog.Logger,
) (string, error) {
	privateKey, keyID, err := keyManager.GetSigningKey(ctx)
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

	user, err := wf.db.GetUser(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("error getting user: %w", err)
	}

	userRoles, err := wf.db.GetUserRoles(ctx, userID)
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
		"iss":   oauth2Issuer(config),
		"sub":   userID.String(),
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

func (wf *Workflows) createOAuth2IDToken(
	ctx context.Context,
	config *Config,
	keyManager *oidcprovider.KeyManager,
	userID uuid.UUID,
	clientID string,
	nonce string,
	scopes []string,
	ttl time.Duration,
	_ *slog.Logger,
) (string, error) {
	privateKey, keyID, err := keyManager.GetSigningKey(ctx)
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
		"iss":       oauth2Issuer(config),
		"sub":       userID.String(),
		"aud":       clientID,
		"iat":       now.Unix(),
		"exp":       now.Add(ttl).Unix(),
		"auth_time": now.Unix(),
	}

	if nonce != "" {
		claims["nonce"] = nonce
	}

	if err := wf.addScopedIDTokenClaims(ctx, claims, scopes, userID); err != nil {
		return "", err
	}

	raw, err := josejwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		return "", fmt.Errorf("error serializing id token: %w", err)
	}

	return raw, nil
}

func (wf *Workflows) addScopedIDTokenClaims(
	ctx context.Context,
	claims map[string]any,
	scopes []string,
	userID uuid.UUID,
) error {
	needsUser := slices.Contains(scopes, "profile") ||
		slices.Contains(scopes, "email") ||
		slices.Contains(scopes, "phone")
	if !needsUser {
		return nil
	}

	user, err := wf.db.GetUser(ctx, userID)
	if err != nil {
		return fmt.Errorf("error getting user: %w", err)
	}

	if slices.Contains(scopes, "profile") {
		addProfileClaims(claims, user)
	}

	if slices.Contains(scopes, "email") && user.Email.Valid {
		claims["email"] = user.Email.String
		claims["email_verified"] = user.EmailVerified
	}

	if slices.Contains(scopes, "phone") && user.PhoneNumber.Valid {
		claims["phone_number"] = user.PhoneNumber.String
		claims["phone_number_verified"] = user.PhoneNumberVerified
	}

	return nil
}

func addProfileClaims(claims map[string]any, user sql.AuthUser) {
	if user.DisplayName != "" {
		claims["name"] = user.DisplayName
	}

	if user.AvatarUrl != "" {
		claims["picture"] = user.AvatarUrl
	}

	if user.Locale != "" {
		claims["locale"] = user.Locale
	}
}

func (wf *Workflows) authenticateClient(
	ctx context.Context,
	expectedClientID string,
	reqClientID *string,
	reqClientSecret *string,
	logger *slog.Logger,
) *OAuth2Error {
	if reqClientID != nil && *reqClientID != expectedClientID {
		return &OAuth2Error{Err: "invalid_client", Description: "Client ID mismatch"}
	}

	client, err := wf.db.GetOAuth2ClientByClientID(ctx, expectedClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting client for auth", logError(err))
		return &OAuth2Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if client.IsPublic {
		return nil
	}

	if reqClientSecret == nil || *reqClientSecret == "" {
		return &OAuth2Error{Err: "invalid_client", Description: "Client secret required"}
	}

	if !verifyHashPassword(*reqClientSecret, client.ClientSecretHash.String) {
		return &OAuth2Error{Err: "invalid_client", Description: "Invalid client credentials"}
	}

	return nil
}

func validatePKCE( //nolint:cyclop
	authReq sql.AuthOauth2AuthRequest,
	codeVerifier *string,
) *OAuth2Error {
	if !authReq.CodeChallenge.Valid || authReq.CodeChallenge.String == "" {
		return nil
	}

	if codeVerifier == nil || *codeVerifier == "" {
		return &OAuth2Error{Err: "invalid_grant", Description: "Missing code_verifier"}
	}

	method := "plain"
	if authReq.CodeChallengeMethod.Valid {
		method = authReq.CodeChallengeMethod.String
	}

	switch method {
	case "S256":
		h := sha256.Sum256([]byte(*codeVerifier))
		encoded := base64.RawURLEncoding.EncodeToString(h[:])

		if encoded != authReq.CodeChallenge.String {
			return &OAuth2Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
		}
	case "plain":
		if *codeVerifier != authReq.CodeChallenge.String {
			return &OAuth2Error{Err: "invalid_grant", Description: "Invalid code_verifier"}
		}
	default:
		return &OAuth2Error{
			Err:         "invalid_request",
			Description: "Unsupported code_challenge_method",
		}
	}

	return nil
}

func oauth2Issuer(config *Config) string {
	if config.OAuth2ProviderIssuer != "" {
		return config.OAuth2ProviderIssuer
	}

	return config.ServerURL.String()
}

func authReqNonce(authReq *sql.AuthOauth2AuthRequest) string {
	if authReq == nil {
		return ""
	}

	if authReq.Nonce.Valid {
		return authReq.Nonce.String
	}

	return ""
}

func pgText(s *string) pgtype.Text {
	if s == nil || *s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: *s, Valid: true}
}

func pgTextFromString(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: s, Valid: true}
}

func pgTextFromCodeChallengeMethod(m *api.Oauth2AuthorizeParamsCodeChallengeMethod) pgtype.Text {
	if m == nil {
		return pgtype.Text{} //nolint:exhaustruct
	}

	return pgtype.Text{String: string(*m), Valid: true}
}

type OAuth2Error struct {
	Err         string
	Description string
}
