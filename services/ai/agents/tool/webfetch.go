package tool

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	md "github.com/JohannesKaufmann/html-to-markdown/v2"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/internal/httpsafe"
)

var (
	errHTTPFetchFailed  = errors.New("fetch failed")
	errTooManyRedirects = errors.New("stopped after 5 redirects")
)

const (
	webFetchTimeout       = 30 * time.Second
	webFetchMaxBodySize   = 1 << 20   // 1 MB
	webFetchMaxOutputSize = 256 << 10 // 256 KB
	webFetchMaxRedirects  = 5
	tlsHandshakeTimeout   = 10 * time.Second
	responseHeaderTimeout = 15 * time.Second
	idleConnTimeout       = 30 * time.Second
	truncatedMarkdownTag  = "\n\n...[truncated]"
)

// WebFetch implements the Tool interface for fetching web pages.
type WebFetch struct {
	client *http.Client
}

// NewWebFetch creates a new web fetch tool.
func NewWebFetch() *WebFetch {
	transport := httpsafe.NewTransport(webFetchTimeout)
	transport.TLSHandshakeTimeout = tlsHandshakeTimeout
	transport.ResponseHeaderTimeout = responseHeaderTimeout
	transport.IdleConnTimeout = idleConnTimeout
	transport.ForceAttemptHTTP2 = true

	client := &http.Client{ //nolint:exhaustruct
		Transport: transport,
		Timeout:   webFetchTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= webFetchMaxRedirects {
				return errTooManyRedirects
			}

			// Re-validate the redirect target's scheme. The SSRF dialer rejects
			// private IPs at dial time, but a redirect that switches to file:,
			// gopher:, data:, etc. would otherwise only be caught by net/http's
			// own scheme check — defense in depth, consistent with httpsafe's
			// contract on the initial URL.
			if _, err := httpsafe.NormalizeURL(req.URL.String()); err != nil {
				return fmt.Errorf("redirect rejected: %w", err)
			}

			return nil
		},
	}

	return &WebFetch{client: client}
}

// Definition returns the tool definition.
func (w *WebFetch) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name:        "web_fetch",
		Description: "Fetch a web page and return its content as markdown. Use this to read the content of a specific URL.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"url": map[string]any{
					"type":        "string",
					"description": "The URL to fetch",
				},
			},
			"required": []string{"url"},
		},
	}
}

type webFetchArgs struct {
	URL string `json:"url"`
}

// Execute fetches a web page and converts it to markdown.
func (w *WebFetch) Execute(
	ctx context.Context,
	arguments string,
	logger *slog.Logger,
) (string, error) {
	var args webFetchArgs
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse arguments: %w", err)
	}

	rawURL, err := httpsafe.NormalizeURL(args.URL)
	if err != nil {
		return "", fmt.Errorf("invalid url: %w", err)
	}

	logger.InfoContext(ctx, "fetching web page", slog.String("url", rawURL))

	body, contentType, err := w.doFetch(ctx, rawURL)
	if err != nil {
		return "", err
	}

	if body == nil {
		return "", nil
	}

	return w.convertBody(body, contentType)
}

func (w *WebFetch) doFetch(ctx context.Context, url string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; NhostAIBot/1.0)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("%w: HTTP %d", errHTTPFetchFailed, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, webFetchMaxBodySize))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read response body: %w", err)
	}

	return body, resp.Header.Get("Content-Type"), nil
}

func (w *WebFetch) convertBody(body []byte, contentType string) (string, error) {
	if strings.Contains(contentType, "text/html") ||
		strings.Contains(contentType, "application/xhtml") {
		markdown, err := md.ConvertString(string(body))
		if err != nil {
			return "", fmt.Errorf("failed to convert HTML to markdown: %w", err)
		}

		return truncateOutput(markdown), nil
	}

	return truncateOutput(string(body)), nil
}

// truncateOutput caps tool output at webFetchMaxOutputSize bytes so a
// pathological page (deeply-nested HTML, repeated escape sequences) cannot
// produce a markdown blob far larger than the source body and blow the
// downstream LLM's context window.
func truncateOutput(s string) string {
	if len(s) <= webFetchMaxOutputSize {
		return s
	}

	i := webFetchMaxOutputSize
	for i > 0 && !utf8.RuneStart(s[i]) {
		i--
	}

	return s[:i] + truncatedMarkdownTag
}
