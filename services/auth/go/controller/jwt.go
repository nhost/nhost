//go:generate mockgen -package mock -destination mock/jwt.go --source=jwt.go
package controller

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nhost/nhost/internal/lib/oapi"
	"github.com/nhost/nhost/services/auth/go/api"
)

const JWTContextKey = "nhost/auth/jwt"

type JWTSecret struct {
	KeyID           string `json:"kid"`
	Key             any    `json:"key"`
	SigningKey      any    `json:"signing_key"`
	Type            string `json:"type"`
	Issuer          string `json:"issuer"`
	ClaimsNamespace string `json:"claims_namespace"`
}

func decodeJWTSecretForRSA(jwtSecret JWTSecret) (JWTSecret, []api.JWK, error) {
	if jwtSecret.Key == nil {
		return JWTSecret{}, nil,
			fmt.Errorf("%w: key is required for RS256, RS384, and RS512", ErrJWTConfiguration)
	}

	privateKeyS, ok := jwtSecret.SigningKey.(string)
	if !ok {
		return JWTSecret{}, nil,
			fmt.Errorf("%w: signing key must be a string", ErrJWTConfiguration)
	}

	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(privateKeyS))
	if err != nil {
		return JWTSecret{}, nil, fmt.Errorf("error parsing rsa private key: %w", err)
	}

	jwtSecret.SigningKey = privateKey

	publicKeyS, ok := jwtSecret.Key.(string)
	if !ok {
		return JWTSecret{}, nil, fmt.Errorf("%w: key must be a string", ErrJWTConfiguration)
	}

	publicKey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(publicKeyS))
	if err != nil {
		return JWTSecret{}, nil, fmt.Errorf("error parsing rsa public key: %w", err)
	}

	jwtSecret.Key = publicKey

	keyID := jwtSecret.KeyID
	if keyID == "" {
		keyID = uuid.NewString()
	}

	jwks := []api.JWK{
		{
			Alg: jwtSecret.Type,
			E:   "AQAB",
			Kid: keyID,
			Kty: "RSA",
			N:   base64.RawURLEncoding.EncodeToString(publicKey.N.Bytes()),
			Use: "sig",
		},
	}

	return jwtSecret, jwks, nil
}

func decodeJWTSecret(jwtSecretb []byte, defaultIssuer string) (JWTSecret, []api.JWK, error) {
	var jwtSecret JWTSecret
	if err := json.Unmarshal(jwtSecretb, &jwtSecret); err != nil {
		return JWTSecret{}, nil, fmt.Errorf("error unmarshalling jwt secret: %w", err)
	}

	if jwtSecret.Issuer == "" {
		jwtSecret.Issuer = defaultIssuer
	}

	if jwtSecret.ClaimsNamespace == "" {
		jwtSecret.ClaimsNamespace = "https://hasura.io/jwt/claims"
	}

	switch jwtSecret.Type {
	case "HS256", "HS384", "HS512":
		if jwtSecret.Key == nil {
			return JWTSecret{}, nil,
				fmt.Errorf("%w: key is required for HS256, HS384, and HS512", ErrJWTConfiguration)
		}

		key, ok := jwtSecret.Key.(string)
		if !ok {
			return JWTSecret{}, nil, fmt.Errorf("%w: key must be a string", ErrJWTConfiguration)
		}

		jwtSecret.Key = []byte(key)
		jwtSecret.SigningKey = []byte(key)

		return jwtSecret, nil, nil
	case "RS256", "RS384", "RS512":
		return decodeJWTSecretForRSA(jwtSecret)
	default:
		return JWTSecret{}, nil,
			fmt.Errorf("%w: unsupported jwt type: %s", ErrJWTConfiguration, jwtSecret.Type)
	}
}

type CustomClaimer interface {
	GetClaims(ctx context.Context, userID string) (map[string]any, error)
}

type JWTGetter struct {
	claimsNamespace      string
	issuer               string
	kid                  string
	signingKey           any
	validatingKey        any
	method               jwt.SigningMethod
	customClaimer        CustomClaimer
	accessTokenExpiresIn time.Duration
	elevatedClaimMode    string
	db                   DBClient
	jwks                 []api.JWK
}

func NewJWTGetter(
	jwtSecretb []byte,
	accessTokenExpiresIn time.Duration,
	customClaimer CustomClaimer,
	elevatedClaimMode string,
	db DBClient,
	defaultIssuer string,
) (*JWTGetter, error) {
	jwtSecret, jwks, err := decodeJWTSecret(jwtSecretb, defaultIssuer)
	if err != nil {
		return nil, err
	}

	method := jwt.GetSigningMethod(jwtSecret.Type)

	return &JWTGetter{
		claimsNamespace:      jwtSecret.ClaimsNamespace,
		issuer:               jwtSecret.Issuer,
		signingKey:           jwtSecret.SigningKey,
		kid:                  jwtSecret.KeyID,
		validatingKey:        jwtSecret.Key,
		method:               method,
		customClaimer:        customClaimer,
		accessTokenExpiresIn: accessTokenExpiresIn,
		elevatedClaimMode:    elevatedClaimMode,
		db:                   db,
		jwks:                 jwks,
	}, nil
}

func (j *JWTGetter) JWKS() []api.JWK {
	return j.jwks
}

func (j *JWTGetter) IsRSA() bool {
	return strings.HasPrefix(j.method.Alg(), "RS")
}

func (j *JWTGetter) Alg() string {
	return j.method.Alg()
}

func pgEncode(v any) (string, error) {
	if v == nil {
		return "null", nil
	}

	if reflect.TypeOf(v).Kind() == reflect.Slice {
		b, err := json.Marshal(v)
		if err != nil {
			return "", fmt.Errorf("error marshalling: %w", err)
		}

		b[0] = '{'
		b[len(b)-1] = '}'

		return string(b), nil
	}

	switch v := v.(type) {
	case string:
		return v, nil
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return "", fmt.Errorf("error marshalling: %w", err)
		}

		return string(b), nil
	}
}

func (j *JWTGetter) addClaimsToMap(
	claims map[string]any,
	newClaims map[string]any,
	allowOverwrite bool,
) error {
	for k, v := range newClaims {
		value, err := pgEncode(v)
		if err != nil {
			return fmt.Errorf("error encoding claim: %w", err)
		}

		// Don't prefix claims if they already have the x-hasura prefix
		if !strings.HasPrefix(strings.ToLower(k), "x-hasura-") {
			k = strings.ToLower("x-hasura-" + k)
		}

		// Check if we should allow overwriting existing claims
		if !allowOverwrite {
			if _, ok := claims[k]; ok {
				// we do not allow these claims to overwrite the default claims
				continue
			}
		}

		claims[k] = value
	}

	return nil
}

// fetchCustomClaims fetches custom claims and returns them. If the custom
// claimer is nil or returns an error, an empty map is returned.
func (j *JWTGetter) fetchCustomClaims(
	ctx context.Context,
	userID uuid.UUID,
	logger *slog.Logger,
) map[string]any {
	if j.customClaimer == nil {
		return nil
	}

	customClaims, err := j.customClaimer.GetClaims(ctx, userID.String())
	if err != nil {
		logger.ErrorContext(
			ctx,
			"error getting custom claims",
			slog.String("error", err.Error()),
		)

		return map[string]any{}
	}

	return customClaims
}

func (j *JWTGetter) GraphQLClaims(
	ctx context.Context,
	userID uuid.UUID,
	isAnonymous bool,
	allowedRoles []string,
	defaultRole string,
	extraClaims map[string]any,
	logger *slog.Logger,
) (string, map[string]any, error) {
	customClaims := j.fetchCustomClaims(ctx, userID, logger)

	c := map[string]any{
		"x-hasura-allowed-roles":     allowedRoles,
		"x-hasura-default-role":      defaultRole,
		"x-hasura-user-id":           userID.String(),
		"x-hasura-user-is-anonymous": strconv.FormatBool(isAnonymous),
	}

	if err := j.addClaimsToMap(c, customClaims, false); err != nil {
		return "", nil, fmt.Errorf("error adding custom claims: %w", err)
	}

	if err := j.addClaimsToMap(c, extraClaims, true); err != nil {
		return "", nil, fmt.Errorf("error adding extra claims: %w", err)
	}

	return j.claimsNamespace, c, nil
}

// RawGraphQLClaims returns the same claims as GraphQLClaims but without
// Postgres-encoding values. Arrays remain as []any, booleans as bool, etc.
// This is suitable for JSON responses (e.g. UserInfo) consumed by third
// parties that expect standard JSON types.
func (j *JWTGetter) RawGraphQLClaims(
	ctx context.Context,
	userID uuid.UUID,
	isAnonymous bool,
	allowedRoles []string,
	defaultRole string,
	extraClaims map[string]any,
	logger *slog.Logger,
) (string, map[string]any, error) {
	customClaims := j.fetchCustomClaims(ctx, userID, logger)

	c := map[string]any{
		"x-hasura-allowed-roles":     allowedRoles,
		"x-hasura-default-role":      defaultRole,
		"x-hasura-user-id":           userID.String(),
		"x-hasura-user-is-anonymous": isAnonymous,
	}

	addRawClaimsToMap(c, customClaims, false)
	addRawClaimsToMap(c, extraClaims, true)

	return j.claimsNamespace, c, nil
}

func addRawClaimsToMap(
	claims map[string]any,
	newClaims map[string]any,
	allowOverwrite bool,
) {
	for k, v := range newClaims {
		if !strings.HasPrefix(strings.ToLower(k), "x-hasura-") {
			k = strings.ToLower("x-hasura-" + k)
		}

		if !allowOverwrite {
			if _, ok := claims[k]; ok {
				continue
			}
		}

		claims[k] = v
	}
}

func (j *JWTGetter) GetToken(
	ctx context.Context,
	userID uuid.UUID,
	isAnonymous bool,
	allowedRoles []string,
	defaultRole string,
	extraClaims map[string]any,
	logger *slog.Logger,
) (string, int64, error) {
	now := time.Now()
	iat := now.Unix()
	exp := now.Add(j.accessTokenExpiresIn).Unix()

	ns, c, err := j.GraphQLClaims(
		ctx, userID, isAnonymous, allowedRoles, defaultRole, extraClaims, logger,
	)
	if err != nil {
		return "", 0, fmt.Errorf("error getting claims: %w", err)
	}

	// Create the Claims
	claims := &jwt.MapClaims{
		"sub": userID.String(),
		"iss": j.issuer,
		"iat": iat,
		"exp": exp,
		ns:    c,
	}

	token := jwt.NewWithClaims(j.method, claims)
	if j.kid != "" {
		token.Header["kid"] = j.kid
	}

	ss, err := token.SignedString(j.signingKey)
	if err != nil {
		return "", 0, fmt.Errorf("error signing token: %w", err)
	}

	return ss, int64(j.accessTokenExpiresIn.Seconds()), nil
}

func (j *JWTGetter) SignTokenWithClaims(
	claims jwt.MapClaims,
	exp time.Time,
) (string, error) {
	now := time.Now()
	iat := now.Unix()

	claims["iss"] = j.issuer
	claims["iat"] = iat
	claims["exp"] = exp.Unix()

	token := jwt.NewWithClaims(j.method, &claims)
	if j.kid != "" {
		token.Header["kid"] = j.kid
	}

	ss, err := token.SignedString(j.signingKey)
	if err != nil {
		return "", fmt.Errorf("error signing token: %w", err)
	}

	return ss, nil
}

func (j *JWTGetter) Validate(accessToken string) (*jwt.Token, error) {
	jwtToken, err := jwt.Parse(
		accessToken,
		func(_ *jwt.Token) (any, error) {
			return j.validatingKey, nil
		},
		jwt.WithValidMethods([]string{j.method.Alg()}),
		jwt.WithIssuer(j.issuer),
		jwt.WithIssuedAt(),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, fmt.Errorf("error parsing token: %w", err)
	}

	return jwtToken, nil
}

func (j *JWTGetter) FromContext(ctx context.Context) (*jwt.Token, bool) {
	token, ok := ctx.Value(JWTContextKey).(*jwt.Token)
	if !ok { //nolint:nestif
		c := oapi.GetGinContext(ctx)
		if c != nil {
			a, ok := c.Get(JWTContextKey)
			if !ok {
				return nil, false
			}

			token, ok = a.(*jwt.Token)
			if !ok {
				return nil, false
			}

			return token, true
		}
	}

	return token, ok
}

func (j *JWTGetter) ToContext(ctx context.Context, jwtToken *jwt.Token) context.Context {
	return context.WithValue(ctx, JWTContextKey, jwtToken) //nolint:revive,staticcheck
}

func (j *JWTGetter) verifyElevatedClaim(
	ctx context.Context,
	token *jwt.Token,
	requestPath string,
) (bool, error) {
	if j.elevatedClaimMode == "disabled" {
		return true, nil
	}

	u, err := token.Claims.GetSubject()
	if err != nil {
		return false, fmt.Errorf("error getting user id from subject: %w", err)
	}

	if j.isElevatedClaimOptional(requestPath) {
		userID, err := uuid.Parse(u)
		if err != nil {
			return false, fmt.Errorf("error parsing user id: %w", err)
		}

		n, err := j.db.CountSecurityKeysUser(ctx, userID)
		if err != nil {
			return false, fmt.Errorf("error checking if user has security keys: %w", err)
		}

		if n == 0 {
			return true, nil
		}
	}

	elevatedClaim := j.GetCustomClaim(token, "x-hasura-auth-elevated")

	return elevatedClaim == u, nil
}

func (j *JWTGetter) isElevatedClaimOptional(requestPath string) bool {
	return j.elevatedClaimMode == "recommended" ||
		slices.Contains(
			[]string{
				"/user/webauthn/add",
				"/user/webauthn/verify",
			},
			requestPath)
}

func (j *JWTGetter) MiddlewareFunc(
	ctx context.Context, input *openapi3filter.AuthenticationInput,
) error {
	authHeader := input.RequestValidationInput.Request.Header.Get("Authorization")

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return &oapi.AuthenticatorError{
			Scheme:  input.SecuritySchemeName,
			Code:    "unauthorized",
			Message: "missing or malformed authorization header",
		}
	}

	jwtToken, err := j.Validate(parts[1])
	if err != nil {
		slog.WarnContext(ctx, "error validating JWT", slog.String("error", err.Error()))

		return &oapi.AuthenticatorError{
			Scheme:  input.SecuritySchemeName,
			Code:    "unauthorized",
			Message: "invalid or expired token",
		}
	}

	if !jwtToken.Valid {
		return &oapi.AuthenticatorError{
			Scheme:  input.SecuritySchemeName,
			Code:    "unauthorized",
			Message: "invalid token",
		}
	}

	if input.SecuritySchemeName == "BearerAuthElevated" {
		var requestPath string
		if input.RequestValidationInput.Request.URL != nil {
			requestPath = input.RequestValidationInput.Request.URL.Path
		}

		found, err := j.verifyElevatedClaim(ctx, jwtToken, requestPath)
		if err != nil {
			slog.WarnContext(
				ctx, "error verifying elevated claim", slog.String("error", err.Error()),
			)

			return &oapi.AuthenticatorError{
				Scheme:  input.SecuritySchemeName,
				Code:    "unauthorized",
				Message: "error verifying elevated claim",
			}
		}

		if !found {
			return &oapi.AuthenticatorError{
				Scheme:  input.SecuritySchemeName,
				Code:    "unauthorized",
				Message: "elevated claim required",
			}
		}
	}

	c := oapi.GetGinContext(ctx)
	c.Set(JWTContextKey, jwtToken)

	return nil
}

func (j *JWTGetter) GetCustomClaim(token *jwt.Token, customClaim string) string {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}

	customClaims, ok := claims[j.claimsNamespace].(map[string]any)
	if !ok {
		return ""
	}

	v, ok := customClaims[customClaim].(string)
	if !ok {
		return ""
	}

	return v
}

func (j *JWTGetter) Issuer() string {
	return j.issuer
}

func (j *JWTGetter) IsAnonymous(token *jwt.Token) bool {
	return j.GetCustomClaim(token, "x-hasura-user-is-anonymous") == "true"
}

func (j *JWTGetter) GetUserID(token *jwt.Token) (uuid.UUID, error) {
	sub, err := token.Claims.GetSubject()
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("error getting subject: %w", err)
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return uuid.UUID{}, fmt.Errorf("error parsing user id: %w", err)
	}

	return userID, nil
}
