package twilio

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/twilio/twilio-go/client"
	oauth "github.com/twilio/twilio-go/rest/oauth/v2"
)

var jwtParser = new(jwt.Parser)

// TokenAuth handles token-based authentication using OAuth.
type TokenAuth struct {
	// Token is the cached OAuth token.
	Token string
}

// NewTokenAuth creates a new TokenAuth instance with the provided token and OAuth client.
func (t *TokenAuth) NewTokenAuth(token string) *TokenAuth {
	return &TokenAuth{Token: token}
}

// FetchToken retrieves the current token if it is valid, or fetches a new token using the OAuth client.
func (t *TokenAuth) FetchToken(ctx context.Context) (string, error) {
	expired, err := t.Expired(ctx)
	if err != nil {
		return "", err
	}
	if t.Token != "" && !expired {
		return t.Token, nil
	}

	return "", nil
}

// Expired returns true if the current token is expired, or the expiration status cannot be determined due to an error.
func (t *TokenAuth) Expired(ctx context.Context) (bool, error) {
	token, _, err := jwtParser.ParseUnverified(t.Token, jwt.MapClaims{})
	if err != nil {
		return true, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return true, err
	}

	exp, ok := claims["exp"].(float64)
	if !ok {
		return true, err
	}

	expirationTime := int64(exp) + 30

	return time.Now().UTC().Unix() > expirationTime, nil
}

// OAuthCredentials holds the necessary credentials for OAuth authentication.
type OAuthCredentials struct {
	// GrantType specifies the type of grant being used for OAuth.
	GrantType string
	// ClientId is the identifier for the client application. ClientSecret is the secret key for the client application.
	ClientId, ClientSecret string
}

// APIOAuth handles OAuth authentication for the Twilio API.
type APIOAuth struct {
	// oauthService is the service used to interact with the OAuth API.
	oauthService *oauth.ApiService
	// creds holds the necessary credentials for OAuth authentication.
	creds *OAuthCredentials
	// tokenAuth *TokenAuth
	tokenAuth TokenAuth
}

// NewAPIOAuth creates a new APIOAuth instance with the provided request handler and credentials.
func NewAPIOAuth(c *client.RequestHandler, creds *OAuthCredentials) *APIOAuth {
	a := &APIOAuth{oauthService: oauth.NewApiService(c), creds: creds}
	return a
}

// GetAccessToken retrieves an access token using the OAuth credentials.
func (a *APIOAuth) GetAccessToken(ctx context.Context) (string, error) {
	if a == nil {
		panic("twilio: API OAuth object is nil")
	}
	if a.creds == nil {
		panic("twilio: API OAuth credentials are nil")
	}
	expired, _ := a.tokenAuth.Expired(ctx)
	if a.tokenAuth.Token != "" && !expired {
		return a.tokenAuth.Token, nil
	}
	params := &oauth.CreateOauth2TokenParams{}
	params.SetGrantType(a.creds.GrantType).
		SetClientId(a.creds.ClientId).
		SetClientSecret(a.creds.ClientSecret)
	a.oauthService.RequestHandler().Client.SetOauth(nil) // set oauth to nil to make no-auth request
	token, err := a.oauthService.CreateOauth2Token(params)
	if err == nil {
		a.tokenAuth = TokenAuth{
			Token: *token.AccessToken,
		}
	}
	if err != nil {
		return "", err
	}
	if token.AccessToken == nil {
		return "", fmt.Errorf("twilio: API response to create a token did not return a valid token")
	}

	return *token.AccessToken, nil
}
