package oauth1

import (
	"context"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Config struct {
	ConsumerKey     string   `json:"consumer_key"`
	ConsumerSecret  string   `json:"consumer_secret"`
	CallbackURL     string   `json:"callback_url"`
	AccessURL       string   `json:"access_url"`
	RequestTokenURL string   `json:"request_token_url"`
	AuthorizeURL    *url.URL `json:"authorize_url"`
}

// SignedRequestOptions contains options for creating a signed OAuth 1.0a request.
type SignedRequestOptions struct {
	Method      string
	URL         string
	Body        io.Reader
	Headers     map[string]string
	ExtraParams map[string]string
	OAuthToken  string
	TokenSecret string
	ContentType string
	Timeout     time.Duration
}

// SignedRequest creates and executes a signed OAuth 1.0a HTTP request.
func (c *Config) SignedRequest(
	ctx context.Context, opts SignedRequestOptions,
) (*http.Response, error) {
	// Set default values
	if opts.Timeout == 0 {
		opts.Timeout = 10 * time.Second //nolint:mnd
	}

	// Build OAuth 1.0a parameters
	params := map[string]string{
		"oauth_consumer_key":     c.ConsumerKey,
		"oauth_nonce":            nonce(),
		"oauth_signature_method": "HMAC-SHA1",
		"oauth_timestamp":        strconv.FormatInt(time.Now().Unix(), 10),
		"oauth_version":          "1.0",
	}

	// Add OAuth token if provided
	if opts.OAuthToken != "" {
		params["oauth_token"] = opts.OAuthToken
	}

	// Add extra parameters
	maps.Copy(params, opts.ExtraParams)

	// Create signature
	params["oauth_signature"] = createSignature(
		opts.Method, opts.URL, c.ConsumerSecret, params, opts.TokenSecret,
	)

	// Build full URL for GET requests with extra parameters
	requestURL := opts.URL
	if opts.Method == http.MethodGet && len(opts.ExtraParams) > 0 {
		parsedURL, err := url.Parse(opts.URL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse URL: %w", err)
		}

		query := parsedURL.Query()
		for k, v := range opts.ExtraParams {
			query.Set(k, v)
		}
		parsedURL.RawQuery = query.Encode()
		requestURL = parsedURL.String()
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, opts.Method, requestURL, opts.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set Authorization header
	req.Header.Set("Authorization", authHeader(params))
	req.Header.Set("Content-Type", opts.ContentType)

	// Add custom headers
	for k, v := range opts.Headers {
		req.Header.Set(k, v)
	}

	// Execute request
	client := &http.Client{Timeout: opts.Timeout} //nolint:exhaustruct
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	return resp, nil
}

func (c *Config) AuthCodeURL(ctx context.Context, state string) (string, error) {
	values, err := c.PostForm(ctx, PostFormOptions{ //nolint:exhaustruct
		URL: c.RequestTokenURL,
		Params: map[string]string{
			"oauth_callback": c.CallbackURL + "?state=" + url.QueryEscape(state),
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to request token: %w", err)
	}

	oauthToken := values.Get("oauth_token")
	callbackConfirmed := values.Get("oauth_callback_confirmed")

	if oauthToken == "" {
		return "", fmt.Errorf("%w: oauth_token not found", ErrInvalidResponse)
	}
	if callbackConfirmed != "true" {
		return "", fmt.Errorf("%w: callback not confirmed", ErrInvalidResponse)
	}

	// Build authorization URL
	query := c.AuthorizeURL.Query()
	query.Set("oauth_token", oauthToken)
	c.AuthorizeURL.RawQuery = query.Encode()
	return c.AuthorizeURL.String(), nil
}

// AccessToken exchanges an OAuth verifier for an access token.
func (c *Config) AccessToken(
	ctx context.Context, requestToken, verifier string,
) (string, string, error) {
	values, err := c.PostForm(ctx, PostFormOptions{ //nolint:exhaustruct
		URL:        c.AccessURL,
		OAuthToken: requestToken,
		Params: map[string]string{
			"oauth_verifier": verifier,
		},
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to exchange token: %w", err)
	}

	accessToken := values.Get("oauth_token")
	tokenSecret := values.Get("oauth_token_secret")

	if accessToken == "" {
		return "", "", fmt.Errorf("%w: access token not found", ErrInvalidResponse)
	}
	if tokenSecret == "" {
		return "", "", fmt.Errorf("%w: token secret not found", ErrInvalidResponse)
	}

	return accessToken, tokenSecret, nil
}
