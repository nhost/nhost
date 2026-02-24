package oauth2

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

// userCodeCharset is a consonant-safe charset that avoids ambiguous characters
// and accidental words.
const userCodeCharset = "BCDFGHJKLMNPQRSTVWXZ"

func generateUserCode() (string, error) {
	buf := make([]byte, UserCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("error generating user code: %w", err)
	}

	code := make([]byte, UserCodeLength)
	for i := range code {
		code[i] = userCodeCharset[int(buf[i])%len(userCodeCharset)]
	}

	return string(code[:4]) + "-" + string(code[4:]), nil
}

func normalizeUserCode(code string) string {
	return strings.ToUpper(strings.ReplaceAll(code, "-", ""))
}

func (p *Provider) CreateDeviceAuthorization(
	ctx context.Context,
	req *api.OAuth2DeviceAuthorizationRequest,
	logger *slog.Logger,
) (*api.OAuth2DeviceAuthorizationResponse, *Error) {
	client, err := p.db.GetOAuth2ClientByClientID(ctx, req.ClientId)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "OAuth2 device auth: unknown client")
		return nil, &Error{Err: "invalid_client", Description: "Unknown client"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	var scopes []string
	if req.Scope != nil && *req.Scope != "" {
		scopes = strings.Split(*req.Scope, " ")
	} else {
		scopes = client.Scopes
	}

	if errMsg := p.validateScopes(scopes); errMsg != "" {
		return nil, &Error{Err: "invalid_scope", Description: errMsg}
	}

	deviceCode := uuid.NewString()
	deviceCodeHash := HashToken(deviceCode)

	userCode, err := generateUserCode()
	if err != nil {
		logger.ErrorContext(ctx, "error generating user code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	normalizedCode := normalizeUserCode(userCode)
	expiresAt := time.Now().Add(DeviceCodeTTL)

	_, err = p.db.InsertOAuth2DeviceCode(ctx, sql.InsertOAuth2DeviceCodeParams{
		DeviceCodeHash:  deviceCodeHash,
		UserCode:        normalizedCode,
		ClientID:        client.ClientID,
		Scopes:          scopes,
		PollingInterval: DeviceCodePollingSec,
		ExpiresAt:       sql.TimestampTz(expiresAt),
	})
	if err != nil {
		logger.ErrorContext(ctx, "error inserting device code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	verifyURL := p.deviceVerifyURL()
	verifyURLComplete := verifyURL + "?user_code=" + userCode
	expiresIn := int(time.Until(expiresAt).Seconds())

	return &api.OAuth2DeviceAuthorizationResponse{
		DeviceCode:              deviceCode,
		UserCode:                userCode,
		VerificationUri:         verifyURL,
		VerificationUriComplete: &verifyURLComplete,
		ExpiresIn:               expiresIn,
		Interval:                DeviceCodePollingSec,
	}, nil
}

func (p *Provider) deviceVerifyURL() string {
	if p.config.DeviceVerifyURL != "" {
		return p.config.DeviceVerifyURL
	}

	return p.config.ClientURL + "/oauth2/device"
}

func (p *Provider) GetDeviceVerification(
	ctx context.Context,
	userCode string,
	logger *slog.Logger,
) (*api.OAuth2DeviceVerifyResponse, *Error) {
	dc, err := p.db.GetOAuth2DeviceCodeByUserCode(ctx, normalizeUserCode(userCode))
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "device code not found for user code")
		return nil, &Error{Err: "invalid_request", Description: "Unknown or expired user code"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting device code by user code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if dc.Status != "pending" {
		return nil, &Error{
			Err:         "invalid_request",
			Description: "Device authorization request already processed",
		}
	}

	return &api.OAuth2DeviceVerifyResponse{
		ClientId: dc.ClientID,
		Scopes:   dc.Scopes,
	}, nil
}

func (p *Provider) CompleteDeviceVerification(
	ctx context.Context,
	userCode string,
	userID uuid.UUID,
	action api.OAuth2DeviceVerifyRequestAction,
	logger *slog.Logger,
) (*api.OAuth2DeviceVerifyResponse, *Error) {
	normalized := normalizeUserCode(userCode)

	switch action {
	case api.Approve:
		dc, err := p.db.ApproveOAuth2DeviceCode(ctx, sql.ApproveOAuth2DeviceCodeParams{
			UserCode: normalized,
			UserID:   pgtype.UUID{Bytes: userID, Valid: true},
		})
		if errors.Is(err, pgx.ErrNoRows) {
			logger.WarnContext(
				ctx, "device code not found or already processed for approval",
			)

			return nil, &Error{
				Err:         "invalid_request",
				Description: "Unknown, expired, or already processed user code",
			}
		}

		if err != nil {
			logger.ErrorContext(ctx, "error approving device code", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		return &api.OAuth2DeviceVerifyResponse{
			ClientId: dc.ClientID,
			Scopes:   dc.Scopes,
		}, nil

	case api.Deny:
		if err := p.db.DenyOAuth2DeviceCode(ctx, normalized); err != nil {
			logger.ErrorContext(ctx, "error denying device code", logError(err))
			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		return &api.OAuth2DeviceVerifyResponse{
			ClientId: "",
			Scopes:   nil,
		}, nil

	default:
		return nil, &Error{
			Err:         "invalid_request",
			Description: "Invalid action, must be 'approve' or 'deny'",
		}
	}
}

// ValidatedDeviceCodeGrant holds the validated state of a device code grant,
// ready for token issuance.
type ValidatedDeviceCodeGrant struct {
	DeviceCode sql.AuthOauth2DeviceCode
	CodeHash   string
	UserID     uuid.UUID
}

func (p *Provider) ValidateDeviceCodeGrant( //nolint:cyclop,funlen
	ctx context.Context,
	req *api.OAuth2TokenRequest,
	logger *slog.Logger,
) (*ValidatedDeviceCodeGrant, *Error) {
	if req.DeviceCode == nil || *req.DeviceCode == "" {
		return nil, &Error{Err: "invalid_request", Description: "Missing device_code"}
	}

	codeHash := HashToken(*req.DeviceCode)

	dc, err := p.db.GetOAuth2DeviceCodeByHash(ctx, codeHash)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "device code not found or expired")
		return nil, &Error{Err: "expired_token", Description: "Device code expired or not found"}
	}

	if err != nil {
		logger.ErrorContext(ctx, "error getting device code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	// Authenticate the client
	client, err := p.db.GetOAuth2ClientByClientID(ctx, dc.ClientID)
	if err != nil {
		logger.ErrorContext(ctx, "error getting OAuth2 client for device code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	if oauthErr := p.authenticateClient(
		client, req.ClientId, req.ClientSecret,
	); oauthErr != nil {
		return nil, oauthErr
	}

	// Enforce polling interval (slow_down)
	if dc.LastPolledAt.Valid {
		elapsed := time.Since(dc.LastPolledAt.Time)
		if elapsed < time.Duration(dc.PollingInterval)*time.Second {
			return nil, &Error{Err: "slow_down", Description: "Polling too frequently"}
		}
	}

	// Update last polled timestamp
	if err := p.db.UpdateOAuth2DeviceCodePolledAt(ctx, codeHash); err != nil {
		logger.ErrorContext(ctx, "error updating device code polled_at", logError(err))
	}

	switch dc.Status {
	case "pending":
		return nil, &Error{
			Err:         "authorization_pending",
			Description: "The authorization request is still pending",
		}
	case "denied":
		return nil, &Error{Err: "access_denied", Description: "The user denied the request"}
	case "approved":
		if !dc.UserID.Valid {
			logger.ErrorContext(ctx, "device code approved but no user_id set")

			return nil, &Error{Err: "server_error", Description: "Internal server error"}
		}

		return &ValidatedDeviceCodeGrant{
			DeviceCode: dc,
			CodeHash:   codeHash,
			UserID:     uuid.UUID(dc.UserID.Bytes),
		}, nil
	default:
		return nil, &Error{Err: "server_error", Description: "Unknown device code status"}
	}
}

func (p *Provider) IssueTokensFromDeviceCode( //nolint:funlen
	ctx context.Context,
	validated *ValidatedDeviceCodeGrant,
	logger *slog.Logger,
) (*api.OAuth2TokenResponse, *Error) {
	dc := validated.DeviceCode

	accessTokenTTL := time.Duration(p.config.AccessTokenTTL) * time.Second
	refreshTokenTTL := time.Duration(p.config.RefreshTokenTTL) * time.Second

	accessToken, err := p.createAccessToken(
		ctx, validated.UserID, dc.ClientID, dc.Scopes, accessTokenTTL, logger,
	)
	if err != nil {
		logger.ErrorContext(ctx, "error creating access token for device code", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	refreshToken := uuid.NewString()
	refreshTokenHash := HashToken(refreshToken)

	_, err = p.db.ConsumeOAuth2DeviceCodeAndInsertRefreshToken(
		ctx,
		sql.ConsumeOAuth2DeviceCodeAndInsertRefreshTokenParams{
			DeviceCodeHash: validated.CodeHash,
			TokenHash:      refreshTokenHash,
			ExpiresAt:      sql.TimestampTz(time.Now().Add(refreshTokenTTL)),
		},
	)
	if errors.Is(err, pgx.ErrNoRows) {
		logger.WarnContext(ctx, "device code already consumed")

		return nil, &Error{
			Err:         "invalid_grant",
			Description: "Device code already consumed",
		}
	}

	if err != nil {
		logger.ErrorContext(
			ctx, "error consuming device code and inserting refresh token", logError(err),
		)

		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	scope := strings.Join(dc.Scopes, " ")

	resp := &api.OAuth2TokenResponse{ //nolint:exhaustruct
		AccessToken:  accessToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(accessTokenTTL.Seconds()),
		RefreshToken: &refreshToken,
		Scope:        &scope,
	}

	if slices.Contains(dc.Scopes, "openid") {
		authTime := time.Now()

		idToken, err := p.createIDToken(
			ctx,
			validated.UserID,
			dc.ClientID,
			"",
			dc.Scopes,
			accessTokenTTL,
			accessToken,
			authTime,
			logger,
		)
		if err != nil {
			logger.ErrorContext(ctx, "error creating ID token for device code", logError(err))
		} else {
			resp.IdToken = &idToken
		}
	}

	return resp, nil
}
