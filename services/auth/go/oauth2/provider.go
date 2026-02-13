package oauth2

import (
	"context"
	"crypto/rsa"
	"log/slog"
	"net/http"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	AuthMethodClientSecretPost = "client_secret_post"
	AuthMethodNone             = "none"
	TokenTypeRefreshToken      = "refresh_token"
	AuthRequestTTL             = 10 * time.Minute
	AuthCodeTTL                = 5 * time.Minute
)

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
	Aud   string
	Scope string
	Iat   time.Time
	Exp   time.Time
	Iss   string
}

type Signer interface {
	RSASigningKey() (*rsa.PrivateKey, string, error)
	SignClaims(claims map[string]any, exp time.Time) (string, error)
	ValidateToken(token string) (*ValidatedClaims, error)
	Issuer() string
	GraphQLClaims(
		ctx context.Context,
		userID uuid.UUID,
		isAnonymous bool,
		allowedRoles []string,
		defaultRole string,
		extraClaims map[string]any,
		logger *slog.Logger,
	) (string, map[string]any, error)
}

type JWTContextReader interface {
	FromContext(ctx context.Context) (*jwtlib.Token, bool)
}

type JWKSProvider interface {
	JWKS() []api.JWK
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Verify(password, hash string) bool
}

type DBClient interface { //nolint:interfacebloat
	CountOAuth2ClientsByCreatedBy(ctx context.Context, createdBy pgtype.UUID) (int64, error)
	GetOAuth2ClientByClientID(ctx context.Context, clientID string) (sql.AuthOauth2Client, error)
	InsertOAuth2Client(
		ctx context.Context, arg sql.InsertOAuth2ClientParams,
	) (sql.AuthOauth2Client, error)
	InsertOAuth2AuthRequest(
		ctx context.Context, arg sql.InsertOAuth2AuthRequestParams,
	) (sql.AuthOauth2AuthRequest, error)
	GetOAuth2AuthRequest(ctx context.Context, id uuid.UUID) (sql.AuthOauth2AuthRequest, error)
	UpdateOAuth2AuthRequestSetUser(
		ctx context.Context, arg sql.UpdateOAuth2AuthRequestSetUserParams,
	) (sql.AuthOauth2AuthRequest, error)
	DeleteOAuth2AuthRequest(ctx context.Context, id uuid.UUID) error
	DeleteExpiredOAuth2AuthRequests(ctx context.Context) error
	InsertOAuth2AuthorizationCode(
		ctx context.Context, arg sql.InsertOAuth2AuthorizationCodeParams,
	) (sql.AuthOauth2AuthorizationCode, error)
	GetOAuth2AuthRequestByCodeHash(
		ctx context.Context, codeHash string,
	) (sql.AuthOauth2AuthRequest, error)
	DeleteOAuth2AuthorizationCode(ctx context.Context, codeHash string) error
	DeleteExpiredOAuth2AuthorizationCodes(ctx context.Context) error
	InsertOAuth2RefreshToken(
		ctx context.Context, arg sql.InsertOAuth2RefreshTokenParams,
	) (sql.AuthOauth2RefreshToken, error)
	GetOAuth2RefreshTokenByHash(
		ctx context.Context, tokenHash string,
	) (sql.AuthOauth2RefreshToken, error)
	DeleteOAuth2RefreshToken(ctx context.Context, tokenHash string) error
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
	db               DBClient
	signer           Signer
	jwtContextReader JWTContextReader
	jwksProvider     JWKSProvider
	hasher           PasswordHasher
	config           Config
	httpClient       *http.Client
}

func NewProvider(
	db DBClient,
	signer Signer,
	jwtContextReader JWTContextReader,
	jwksProvider JWKSProvider,
	hasher PasswordHasher,
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

	return &Provider{
		db:               db,
		signer:           signer,
		jwtContextReader: jwtContextReader,
		jwksProvider:     jwksProvider,
		hasher:           hasher,
		config:           config,
		httpClient:       httpClient,
	}
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
