package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

var (
	ErrMissingToken = errors.New("missing bearer token")
	ErrInvalidToken = errors.New("invalid bearer token")
	ErrRoleMismatch = errors.New("token default role does not match enforced role")
)

func scopesForRole(enforceRole string) []string {
	if enforceRole != "" {
		return []string{"openid", "graphql:role:" + enforceRole}
	}

	return []string{"openid", "graphql"}
}

type Auth struct {
	authURL     string
	realm       string
	enforceRole string
	keyfunc     keyfunc.Keyfunc
	metadata    AuthorizationServerMetadata
}

type AuthorizationServerMetadata struct {
	Issuer                            string   `json:"issuer"`
	JWKSURI                           string   `json:"jwks_uri"`
	AuthorizationEndpoint             string   `json:"authorization_endpoint"`
	TokenEndpoint                     string   `json:"token_endpoint"`
	ScopesSupported                   []string `json:"scopes_supported,omitempty"`
	ResponseTypesSupported            []string `json:"response_types_supported"`
	GrantTypesSupported               []string `json:"grant_types_supported"`
	TokenEndpointAuthMethodsSupported []string `json:"token_endpoint_auth_methods_supported"`
	CodeChallengeMethodsSupported     []string `json:"code_challenge_methods_supported"`
	ClientIDMetadataDocumentSupported bool     `json:"client_id_metadata_document_supported"`
}

type ProtectedResourceMetadata struct {
	Resource             string   `json:"resource"`
	AuthorizationServers []string `json:"authorization_servers"`
	ScopesSupported      []string `json:"scopes_supported,omitempty"`
	ResourceName         string   `json:"resource_name,omitempty"`
}

func New(
	ctx context.Context,
	authURL string,
	realm string,
	enforceRole string,
) (*Auth, error) {
	authURL = strings.TrimRight(authURL, "/")

	jwksURL := authURL + "/.well-known/jwks.json"

	kf, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, fmt.Errorf("failed to create keyfunc from JWKS URL %s: %w", jwksURL, err)
	}

	metadata := AuthorizationServerMetadata{
		Issuer:                            authURL,
		JWKSURI:                           jwksURL,
		AuthorizationEndpoint:             authURL + "/oauth2/authorize",
		TokenEndpoint:                     authURL + "/oauth2/token",
		ScopesSupported:                   scopesForRole(enforceRole),
		ResponseTypesSupported:            []string{"code"},
		GrantTypesSupported:               []string{"authorization_code", "refresh_token"},
		TokenEndpointAuthMethodsSupported: []string{"none"},
		CodeChallengeMethodsSupported:     []string{"S256"},
		ClientIDMetadataDocumentSupported: true,
	}

	return &Auth{
		authURL:     authURL,
		realm:       realm,
		enforceRole: enforceRole,
		keyfunc:     kf,
		metadata:    metadata,
	}, nil
}

func (a *Auth) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := a.extractAndValidateToken(c.Request)
		if err != nil {
			_ = c.Error(err)

			a.writeUnauthorized(c)

			return
		}

		if a.enforceRole != "" {
			if err := a.checkRole(token); err != nil {
				_ = c.Error(err)
				c.AbortWithStatus(http.StatusForbidden)

				return
			}
		}

		ctx := context.WithValue(c.Request.Context(), jwtContextKey{}, token)

		logger := middleware.LoggerFromContext(ctx)
		logger = logger.With(sessionAttributes(token))
		ctx = middleware.LoggerToContext(ctx, logger)

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func (a *Auth) checkRole(token *jwt.Token) error {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ErrRoleMismatch
	}

	hasuraClaims, ok := claims[hasuraClaimsNamespace].(map[string]any)
	if !ok {
		return ErrRoleMismatch
	}

	defaultRole, ok := hasuraClaims["x-hasura-default-role"].(string)
	if !ok || defaultRole != a.enforceRole {
		return ErrRoleMismatch
	}

	return nil
}

const hasuraClaimsNamespace = "https://hasura.io/jwt/claims"

func sessionAttributes(token *jwt.Token) slog.Attr {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return slog.Group("session")
	}

	attrs := make([]any, 0)

	if sub, ok := claims["sub"].(string); ok {
		attrs = append(attrs, slog.String("sub", sub))
	}

	if hasuraClaims, ok := claims[hasuraClaimsNamespace].(map[string]any); ok {
		for key, value := range hasuraClaims {
			attrs = append(attrs, slog.Any(key, value))
		}
	}

	return slog.Group("session", attrs...)
}

func (a *Auth) AuthorizationServerHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, a.metadata)
	}
}

func (a *Auth) ProtectedResourceHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		resource := requestScheme(c.Request) + "://" + c.Request.Host

		c.JSON(http.StatusOK, ProtectedResourceMetadata{
			Resource:             resource,
			AuthorizationServers: []string{a.authURL},
			ScopesSupported:      scopesForRole(a.enforceRole),
			ResourceName:         "",
		})
	}
}

func (a *Auth) extractAndValidateToken(r *http.Request) (*jwt.Token, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, ErrMissingToken
	}

	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(authHeader, bearerPrefix) {
		return nil, ErrMissingToken
	}

	tokenString := strings.TrimPrefix(authHeader, bearerPrefix)
	if tokenString == "" {
		return nil, ErrMissingToken
	}

	token, err := jwt.Parse(
		tokenString,
		a.keyfunc.KeyfuncCtx(r.Context()),
		jwt.WithIssuedAt(),
		jwt.WithExpirationRequired(),
		jwt.WithIssuer(a.authURL),
	)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return token, nil
}

func (a *Auth) writeUnauthorized(c *gin.Context) {
	resourceMetadataURL := requestScheme(c.Request) + "://" + c.Request.Host +
		"/.well-known/oauth-protected-resource"

	c.Header(
		"WWW-Authenticate",
		fmt.Sprintf(
			`Bearer realm="%s", resource_metadata="%s"`,
			a.realm,
			resourceMetadataURL,
		),
	)
	c.AbortWithStatus(http.StatusUnauthorized)
}

func requestScheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}

	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		return proto
	}

	return "http"
}

type jwtContextKey struct{}

func TokenFromContext(ctx context.Context) (*jwt.Token, bool) {
	token, ok := ctx.Value(jwtContextKey{}).(*jwt.Token)
	return token, ok
}
