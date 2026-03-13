package nhmiddleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	nhcontext "github.com/nhost/be/lib/graphql/context"
	"github.com/sirupsen/logrus"
)

const (
	claimNamespace    = "https://hasura.io/jwt/claims"
	claimAllowedRoles = "x-hasura-allowed-roles"
	claimDefaultRole  = "x-hasura-default-role"

	roleAdmin               = "admin"
	rolePublic              = "public"
	headerHasuraAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec
	headerHasuraRole        = "X-Hasura-Role"
	headerHasuraUserID      = "X-Hasura-User-Id"
	headerWebbhookSecret    = "X-Nhost-Webhook-Secret" //nolint:gosec
	headerAuthorization     = "Authorization"
)

type (
	sessionVariablesToCtx struct{}
)

type SessionVariables struct {
	HasAdminSecret   bool
	HasWebhookSecret bool
	UserID           string
	Role             string
	AllowedRoles     []any
	DefaultRole      any
}

type JWTSecret struct {
	Type   string `json:"type"`
	Key    string `json:"key"`
	Issuer string `json:"issuer"`
}

// ParseJWTSecret parses a JSON-encoded JWTSecret, handling literal newlines
// in the key field that occur when PEM keys are rendered from TOML secrets.
func ParseJWTSecret(data []byte) (JWTSecret, error) {
	var secret JWTSecret
	if err := json.Unmarshal(data, &secret); err != nil {
		// Literal newlines inside JSON string values (from TOML-rendered PEM keys)
		// make the JSON invalid. Escape them to preserve newline positions in the key.
		sanitized := strings.ReplaceAll(string(data), "\n", "\\n")
		if err := json.Unmarshal([]byte(sanitized), &secret); err != nil {
			return JWTSecret{}, fmt.Errorf("problem parsing jwt secret: %w", err)
		}
	}

	// Normalize literal \n sequences to actual newlines (common when PEM keys
	// are passed through environment variables or config files as single-line values).
	secret.Key = strings.ReplaceAll(secret.Key, `\n`, "\n")

	return secret, nil
}

func ParseJWTFunc(jwtSecret JWTSecret) (func(tokenString string) (*jwt.Token, error), error) {
	signinMethod := jwt.GetSigningMethod(jwtSecret.Type)

	parserOpts := []jwt.ParserOption{
		jwt.WithIssuedAt(),
		jwt.WithExpirationRequired(),
	}

	if jwtSecret.Issuer != "" {
		parserOpts = append(parserOpts, jwt.WithIssuer(jwtSecret.Issuer))
	}

	parser := jwt.NewParser(parserOpts...)

	var verificationKey any

	switch signinMethod.(type) {
	case *jwt.SigningMethodRSA, *jwt.SigningMethodRSAPSS:
		key, err := jwt.ParseRSAPublicKeyFromPEM([]byte(jwtSecret.Key))
		if err != nil {
			return nil, fmt.Errorf("error parsing RSA public key: %w", err)
		}

		verificationKey = key
	default:
		verificationKey = []byte(jwtSecret.Key)
	}

	return func(tokenString string) (*jwt.Token, error) {
		token, err := parser.Parse(tokenString, func(t *jwt.Token) (any, error) {
			if t.Method != signinMethod {
				return nil, ErrUnexpectSigningMethod
			}

			return verificationKey, nil
		})
		if err != nil {
			return nil, fmt.Errorf("error parsing token: %w", err)
		}

		return token, nil
	}, nil
}

func SessionVariablesToCtx(ctx context.Context, session *SessionVariables) context.Context {
	return context.WithValue(ctx, sessionVariablesToCtx{}, session)
}

func SessionVariablesFromCtx(ctx context.Context) *SessionVariables {
	s := ctx.Value(sessionVariablesToCtx{})

	session, ok := s.(*SessionVariables)
	if !ok {
		return nil
	}

	return session
}

type JWTParser func(tokenString string) (*jwt.Token, error)

func SessionVariablesReader(
	adminSecret string,
	webhookSecret string,
	jwtParser JWTParser,
) func(c *gin.Context) {
	return func(c *gin.Context) {
		logger := nhcontext.LoggerFromContext(c.Request.Context())

		session, err := getSessionVariables(
			adminSecret,
			webhookSecret,
			jwtParser,
			c.Request.Header,
			logger,
		)
		if err != nil {
			logger.WithError(err).Error("error getting session variables")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"message": "unauthorized",
			})

			return
		}

		c.Request = c.Request.WithContext(
			SessionVariablesToCtx(c.Request.Context(), session),
		)

		c.Next()
	}
}

// NewWebSocketInit returns a transport.WebsocketInitFunc that extracts headers
// from the init payload and validates session variables (JWT, admin/webhook secrets).
func NewWebSocketInit(
	adminSecret string,
	webhookSecret string,
	jwtParser JWTParser,
) transport.WebsocketInitFunc {
	return func(
		ctx context.Context,
		initPayload transport.InitPayload,
	) (context.Context, *transport.InitPayload, error) {
		ctx, payload, err := nhcontext.WebSocketInit(ctx, initPayload)
		if err != nil {
			return ctx, payload, fmt.Errorf("websocket init: %w", err)
		}

		headers := nhcontext.InitPayloadHeadersFromCtx(ctx)
		if headers == nil {
			return ctx, payload, nil
		}

		logger := nhcontext.LoggerFromContext(ctx)

		session, err := getSessionVariables(
			adminSecret,
			webhookSecret,
			jwtParser,
			headers,
			logger,
		)
		if err != nil {
			return ctx, payload, fmt.Errorf("unauthorized: %w", err)
		}

		ctx = SessionVariablesToCtx(ctx, session)

		return ctx, payload, nil
	}
}

func getSessionVariables(
	adminSecret string,
	webhookSecret string,
	jwtParser JWTParser,
	headers http.Header,
	logger *logrus.Entry,
) (*SessionVariables, error) {
	switch {
	case headers.Get(headerHasuraAdminSecret) != "":
		logger.Debug("authorizeAdminSecret")
		return getSessionVariablesFromAdminSecret(adminSecret, headers, logger)
	case headers.Get(headerWebbhookSecret) != "":
		logger.Debug("authorizeWebhookSecret")
		return getSessionVariablesFromWebhookSecret(webhookSecret, headers, logger)
	case headers.Get(headerAuthorization) != "":
		logger.Debug("authorizeAccessToken")
		return getSessionVariablesFromAccessToken(jwtParser, headers, logger)
	default:
		return &SessionVariables{
			HasAdminSecret:   false,
			HasWebhookSecret: false,
			UserID:           "",
			Role:             rolePublic,
			AllowedRoles: []any{
				rolePublic,
			},
			DefaultRole: rolePublic,
		}, nil
	}
}

func getSessionVariablesFromWebhookSecret(
	webhookSecret string, headers http.Header, logger *logrus.Entry,
) (*SessionVariables, error) {
	if webhookSecret == "" {
		return nil, ErrNotAuthorized
	}

	if headers.Get(headerWebbhookSecret) != webhookSecret {
		logger.Error("webhook secret not valid")
		return nil, ErrNotAuthorized
	}

	role := headers.Get(headerHasuraRole)
	userID := headers.Get(headerHasuraUserID)

	return &SessionVariables{
		HasAdminSecret:   false,
		HasWebhookSecret: true,
		UserID:           userID,
		Role:             role,
		AllowedRoles:     []any{},
		DefaultRole:      claimDefaultRole,
	}, nil
}

func getSessionVariablesFromAdminSecret(
	adminSecret string, headers http.Header, logger *logrus.Entry,
) (*SessionVariables, error) {
	if adminSecret == "" {
		return nil, ErrNotAuthorized
	}

	if headers.Get(headerHasuraAdminSecret) != adminSecret {
		logger.Error("admin secret not valid")
		return nil, ErrWrongAdminSecret
	}

	role := roleAdmin
	if headers.Get(headerHasuraRole) != "" {
		role = headers.Get(headerHasuraRole)
	}

	userID := headers.Get(headerHasuraUserID)

	return &SessionVariables{
		HasAdminSecret:   true,
		HasWebhookSecret: false,
		UserID:           userID,
		Role:             role,
		AllowedRoles:     []any{},
		DefaultRole:      claimDefaultRole,
	}, nil
}

func getSessionVariablesFromAccessToken( //nolint:cyclop,funlen
	jwtParser JWTParser, headers http.Header, logger *logrus.Entry,
) (*SessionVariables, error) {
	if jwtParser == nil {
		return nil, ErrNotAuthorized
	}

	accessToken := strings.TrimPrefix(headers.Get(headerAuthorization), "Bearer ")

	token, err := jwtParser(accessToken)
	if err != nil {
		logger.WithError(err).Error("error parsing jwt")
		return nil, ErrNotAuthorized
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		logger.Error("claims not valid")
		return nil, ErrNotAuthorized
	}

	claimsNamespace, ok := claims[claimNamespace].(map[string]any)
	if !ok {
		logger.Error("claims namespace not valid")
		return nil, ErrNotAuthorized
	}

	allowedRoles, ok := claimsNamespace[claimAllowedRoles].([]any)
	if !ok {
		logger.Error("allowed roles not valid")
		return nil, ErrNotAuthorized
	}

	defaultRole, ok := claimsNamespace[claimDefaultRole]
	if !ok {
		logger.Error("default role not valid")
		return nil, ErrNotAuthorized
	}

	r := defaultRole
	if headers.Get(headerHasuraRole) != "" {
		r = headers.Get(headerHasuraRole)
		if !slices.Contains(allowedRoles, r) {
			logger.Error("role not present in allowed roles")
			return nil, ErrNotAuthorized
		}
	}

	userID, err := claims.GetSubject()
	if err != nil {
		logger.WithError(err).Error("error getting subject from claims")
		return nil, ErrNotAuthorized
	}

	role, ok := r.(string)
	if !ok {
		return nil, ErrNotAuthorized
	}

	return &SessionVariables{
		HasAdminSecret:   false,
		HasWebhookSecret: false,
		UserID:           userID,
		Role:             role,
		AllowedRoles:     allowedRoles,
		DefaultRole:      defaultRole,
	}, nil
}
