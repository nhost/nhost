package oauth2

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	AuthMethodClientSecretBasic = "client_secret_basic"
	AuthMethodClientSecretPost  = "client_secret_post"
	AuthMethodNone              = "none"
	TokenTypeRefreshToken       = "refresh_token"
	AuthRequestTTL              = 10 * time.Minute
	AuthCodeTTL                 = 5 * time.Minute
)

// DefaultScopes returns the canonical set of scopes assigned to a new OAuth2
// client when no explicit scopes are provided. All creation paths (CIMD,
// Hasura mutation) should use this same set so behaviour is consistent
// regardless of how the client was registered.
func DefaultScopes() []string {
	return []string{"openid", "profile", "email", "phone", "offline_access", "graphql"}
}

type Config struct {
	LoginURL                   string
	ClientURL                  string
	ServerURL                  string
	AccessTokenTTL             int
	RefreshTokenTTL            int
	CIMDEnabled                bool
	CIMDAllowInsecureTransport bool
}

type ValidatedClaims struct {
	Sub   string
	Aud   []string
	Scope string
	Iat   time.Time
	Exp   time.Time
	Iss   string
}

//go:generate mockgen -package mock -destination mock/signer.go . Signer
type Signer interface {
	SignTokenWithClaims(claims jwt.MapClaims, exp time.Time) (string, error)
	Validate(token string) (*jwt.Token, error)
	Issuer() string
	Alg() string
	GraphQLClaims(
		ctx context.Context,
		userID uuid.UUID,
		isAnonymous bool,
		allowedRoles []string,
		defaultRole string,
		extraClaims map[string]any,
		logger *slog.Logger,
	) (string, map[string]any, error)
	RawGraphQLClaims(
		ctx context.Context,
		userID uuid.UUID,
		isAnonymous bool,
		allowedRoles []string,
		defaultRole string,
		extraClaims map[string]any,
		logger *slog.Logger,
	) (string, map[string]any, error)
}

type VerifySecretFunc func(password, hash string) bool

//go:generate mockgen -package mock -destination mock/db_client.go . DBClient
type DBClient interface { //nolint:interfacebloat
	GetOAuth2ClientByClientID(ctx context.Context, clientID string) (sql.AuthOauth2Client, error)
	InsertOAuth2AuthRequest(
		ctx context.Context, arg sql.InsertOAuth2AuthRequestParams,
	) (sql.AuthOauth2AuthRequest, error)
	GetOAuth2AuthRequest(ctx context.Context, id uuid.UUID) (sql.AuthOauth2AuthRequest, error)
	CompleteOAuth2LoginAndInsertCode(
		ctx context.Context, arg sql.CompleteOAuth2LoginAndInsertCodeParams,
	) (sql.AuthOauth2AuthorizationCode, error)
	DeleteOAuth2AuthRequest(ctx context.Context, id uuid.UUID) error
	DeleteExpiredOAuth2AuthRequests(ctx context.Context) error
	GetOAuth2AuthorizationCodeAuthRequest(
		ctx context.Context, codeHash string,
	) (sql.AuthOauth2AuthRequest, error)
	ConsumeOAuth2CodeAndInsertRefreshToken(
		ctx context.Context, arg sql.ConsumeOAuth2CodeAndInsertRefreshTokenParams,
	) (sql.AuthOauth2RefreshToken, error)
	DeleteExpiredOAuth2AuthorizationCodes(ctx context.Context) error
	GetOAuth2RefreshTokenByHash(
		ctx context.Context, tokenHash string,
	) (sql.AuthOauth2RefreshToken, error)
	DeleteOAuth2RefreshTokenByHashAndClientID(
		ctx context.Context, arg sql.DeleteOAuth2RefreshTokenByHashAndClientIDParams,
	) error
	UpdateOAuth2RefreshToken(
		ctx context.Context, arg sql.UpdateOAuth2RefreshTokenParams,
	) (sql.AuthOauth2RefreshToken, error)
	DeleteOAuth2RefreshTokensByUserID(ctx context.Context, userID uuid.UUID) error
	DeleteExpiredOAuth2RefreshTokens(ctx context.Context) error
	UpsertOAuth2CIMDClient(
		ctx context.Context, arg sql.UpsertOAuth2CIMDClientParams,
	) (sql.AuthOauth2Client, error)

	GetUser(ctx context.Context, id uuid.UUID) (sql.AuthUser, error)
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]sql.AuthUserRole, error)
}

type Provider struct {
	db           DBClient
	signer       Signer
	jwks         []api.JWK
	verifySecret VerifySecretFunc
	config       Config
	httpClient   *http.Client
	validScopes  map[string]struct{}
}

func NewProvider(
	db DBClient,
	signer Signer,
	jwks []api.JWK,
	verifySecret VerifySecretFunc,
	config Config,
	httpClient *http.Client,
) *Provider {
	if httpClient == nil {
		if config.CIMDAllowInsecureTransport {
			httpClient = newInsecureHTTPClient()
		} else {
			httpClient = newSafeHTTPClient()
		}
	}

	vs := make(map[string]struct{}, len(DefaultScopes()))
	for _, s := range DefaultScopes() {
		vs[s] = struct{}{}
	}

	return &Provider{
		db:           db,
		signer:       signer,
		jwks:         jwks,
		verifySecret: verifySecret,
		config:       config,
		httpClient:   httpClient,
		validScopes:  vs,
	}
}

// validateScopes returns an error description if any scope in the list is not
// recognised, or "" if all scopes are valid.
func (p *Provider) validateScopes(scopes []string) string {
	for _, s := range scopes {
		if _, ok := p.validScopes[s]; !ok {
			return "invalid scope: " + s
		}
	}

	return ""
}

func (p *Provider) DeleteExpiredRecords(ctx context.Context, logger *slog.Logger) {
	if err := p.db.DeleteExpiredOAuth2AuthRequests(ctx); err != nil {
		logger.ErrorContext(ctx, "error deleting expired OAuth2 auth requests", logError(err))
	}

	if err := p.db.DeleteExpiredOAuth2AuthorizationCodes(ctx); err != nil {
		logger.ErrorContext(ctx, "error deleting expired OAuth2 authorization codes", logError(err))
	}

	if err := p.db.DeleteExpiredOAuth2RefreshTokens(ctx); err != nil {
		logger.ErrorContext(ctx, "error deleting expired OAuth2 refresh tokens", logError(err))
	}
}

func (p *Provider) Issuer() string {
	return p.signer.Issuer()
}
