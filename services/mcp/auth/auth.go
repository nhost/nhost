package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrMissingToken = errors.New("missing bearer token")
	ErrInvalidToken = errors.New("invalid bearer token")
)

type Auth struct {
	authURL  string
	realm    string
	scopes   []string
	keyfunc  keyfunc.Keyfunc
	metadata AuthorizationServerMetadata
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
	scopes []string,
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
		ScopesSupported:                   scopes,
		ResponseTypesSupported:            []string{"code"},
		GrantTypesSupported:               []string{"authorization_code", "refresh_token"},
		TokenEndpointAuthMethodsSupported: []string{"none"},
		CodeChallengeMethodsSupported:     []string{"S256"},
		ClientIDMetadataDocumentSupported: true,
	}

	return &Auth{
		authURL:  authURL,
		realm:    realm,
		scopes:   scopes,
		keyfunc:  kf,
		metadata: metadata,
	}, nil
}

func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := a.extractAndValidateToken(r)
		if err != nil {
			a.writeUnauthorized(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), jwtContextKey{}, token)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *Auth) AuthorizationServerHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(a.metadata); err != nil {
			http.Error(w, "failed to encode metadata", http.StatusInternalServerError)
		}
	}
}

func (a *Auth) ProtectedResourceHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resource := "https://" + r.Host

		resp := ProtectedResourceMetadata{
			Resource:             resource,
			AuthorizationServers: []string{a.authURL},
			ScopesSupported:      a.scopes,
			ResourceName:         "",
		}

		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(resp); err != nil {
			http.Error(w, "failed to encode metadata", http.StatusInternalServerError)
		}
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

func (a *Auth) writeUnauthorized(w http.ResponseWriter, r *http.Request) {
	resourceMetadataURL := "https://" + r.Host +
		"/.well-known/oauth-protected-resource"

	w.Header().Set(
		"WWW-Authenticate",
		fmt.Sprintf(
			`Bearer realm="%s", resource_metadata="%s"`,
			a.realm,
			resourceMetadataURL,
		),
	)
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}

type jwtContextKey struct{}

func TokenFromContext(ctx context.Context) (*jwt.Token, bool) {
	token, ok := ctx.Value(jwtContextKey{}).(*jwt.Token)
	return token, ok
}
