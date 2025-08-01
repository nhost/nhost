package hibp

import (
	"bufio"
	"context"
	"crypto/sha1" //nolint:gosec
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	rangeURL           = "https://api.pwnedpasswords.com/range/"
	retryRateLimitTime = 3 * time.Second
	maxRetries         = 3
)

type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{}, //nolint:exhaustruct
	}
}

func sha1Hash(password string) string {
	sha1 := sha1.New() //nolint:gosec
	sha1.Write([]byte(password))

	return strings.ToUpper(hex.EncodeToString(sha1.Sum(nil)))
}

func (c *Client) getRangeResponse(
	ctx context.Context,
	rnge string,
	retry int,
) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rangeURL+rnge, nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests && retry < maxRetries {
		time.Sleep(retryRateLimitTime)
		return c.getRangeResponse(ctx, rnge, retry+1)
	}

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		defer resp.Body.Close()

		return nil, fmt.Errorf("error getting response: %w: %s", err, string(b))
	}

	return resp, nil
}

func (c *Client) IsPasswordPwned(ctx context.Context, password string) (bool, error) {
	hashedPassword := sha1Hash(password)

	resp, err := c.getRangeResponse(ctx, hashedPassword[:5], 0)
	if err != nil {
		return false, fmt.Errorf("error querying hibp: %w", err)
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	hashSuffix := hashedPassword[5:]

	for scanner.Scan() {
		line := scanner.Text()

		parts := strings.Split(line, ":")
		if parts[0] == hashSuffix {
			return true, nil
		}
	}

	return false, nil
}
