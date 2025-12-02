package providers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"golang.org/x/oauth2"
)

const appleMaxAge = time.Hour * 24 * 180

type Apple struct {
	*oauth2.Config

	oidc *oidc.IDTokenValidator
}

// NewAppleProvider creates a new Apple OAuth2 provider with JWT token generation support.
func NewAppleProvider(
	ctx context.Context,
	clientID, clientSecret, authServerURL string,
	scopes []string,
) (*Provider, error) {
	idtokenProvider, err := oidc.NewIDTokenValidator(
		ctx, api.IdTokenProviderApple, clientID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create ID token provider: %w", err)
	}

	apple := &Apple{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  authServerURL + "/signin/provider/apple/callback",
			Scopes:       scopes,
			Endpoint: oauth2.Endpoint{ //nolint:exhaustruct
				AuthURL:  "https://appleid.apple.com/auth/authorize",
				TokenURL: "https://appleid.apple.com/auth/token",
			},
		},
		oidc: idtokenProvider,
	}

	return NewOauth2Provider(apple), nil
}

// GenerateClientSecret creates a JWT token for Apple authentication
// This should be called instead of using a static client secret.
func GenerateClientSecret(teamID, keyID, clientID, privateKeyBase64 string) (string, error) {
	// Replace escaped newlines with actual newlines
	privateKeyPEM := strings.ReplaceAll(privateKeyBase64, "\\n", "\n")

	// Check if the private key is base64 encoded
	if !strings.HasPrefix(privateKeyPEM, "-----BEGIN") {
		// Try to decode from base64
		decodedBytes, err := base64.StdEncoding.DecodeString(privateKeyPEM)
		if err != nil {
			return "", fmt.Errorf("failed to decode private key from base64: %w", err)
		}

		privateKeyPEM = string(decodedBytes)
	}

	// Parse the private key
	privateKey, err := jwt.ParseECPrivateKeyFromPEM([]byte(privateKeyPEM))
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the token
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"iss": teamID,                      // Team ID
		"iat": now.Unix(),                  // Issued at
		"exp": now.Add(appleMaxAge).Unix(), // 180 days validity
		"aud": "https://appleid.apple.com", // Apple's authorization server
		"sub": clientID,                    // Client ID
	})

	// Set the key ID in the header
	token.Header["kid"] = keyID

	// Sign the token
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return tokenString, nil
}

type appleUser struct {
	Name struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	} `json:"name"`
}

func (a *Apple) GetProfile(
	_ context.Context,
	_ string,
	idToken *string,
	extra map[string]any,
) (oidc.Profile, error) {
	if idToken == nil {
		return oidc.Profile{}, errors.New("idToken is nil") //nolint:err113
	}

	token, err := a.oidc.Validate(*idToken, "")
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to validate id token: %w", err)
	}

	email, err := oidc.GetClaim[string](token, "email")
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to get email claim: %w", err)
	}

	emailVerified, err := oidc.GetClaim[bool](token, "email_verified")
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to get email_verified claim: %w", err)
	}

	sub, err := token.Claims.GetSubject()
	if err != nil {
		return oidc.Profile{}, fmt.Errorf("failed to get subject claim: %w", err)
	}

	displayName := email

	userRaw, ok := extra["user"].(string)
	if ok { //nolint:nestif
		var user appleUser
		if err := json.Unmarshal([]byte(userRaw), &user); err == nil {
			if user.Name.FirstName != "" {
				displayName = user.Name.FirstName
			}

			if user.Name.LastName != "" {
				displayName += " " + user.Name.LastName
			}
		}
	}

	return oidc.Profile{
		ProviderUserID: sub,
		Email:          email,
		EmailVerified:  emailVerified,
		Name:           displayName,
		Picture:        "",
	}, nil
}

func (a *Apple) AuthCodeURL(
	state string, _ *api.ProviderSpecificParams, opts ...oauth2.AuthCodeOption,
) string {
	opts = append(
		opts,
		oauth2.SetAuthURLParam("response_mode", "form_post"),
		oauth2.SetAuthURLParam("response_type", "code id_token"),
	)

	return a.Config.AuthCodeURL(state, opts...)
}
