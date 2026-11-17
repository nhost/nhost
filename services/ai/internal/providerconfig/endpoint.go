package providerconfig

import (
	"cmp"
	"errors"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	// ErrInvalidBaseURL identifies a rejected base URL without exposing its value.
	ErrInvalidBaseURL = errors.New("invalid provider base URL")
	// ErrInvalidHeaders identifies rejected headers without exposing their values.
	ErrInvalidHeaders = errors.New("invalid provider headers")
	// ErrRedirect prevents credentials from being forwarded through redirects.
	ErrRedirect = errors.New("provider redirects are not allowed")
)

// Endpoint contains a validated base URL and a private copy of declared headers.
type Endpoint struct {
	BaseURL string
	Headers map[string]string
}

// NewEndpoint validates the common URL rules, adapter URL policy, and headers,
// in that order. Header restrictions must be lowercase; validateAdapterURL must
// be non-nil. Trusted private-network endpoints are allowed.
func NewEndpoint(
	baseURL string,
	headers map[string]string,
	validateAdapterURL func(string) error,
	forbiddenHeaderPrefixes []string,
	forbiddenHeaders map[string]struct{},
) (Endpoint, error) {
	if err := validateProviderBaseURL(baseURL); err != nil {
		return Endpoint{}, err
	}

	if err := validateAdapterURL(baseURL); err != nil {
		return Endpoint{}, err
	}

	if err := validateProviderHeaders(
		headers,
		forbiddenHeaderPrefixes,
		forbiddenHeaders,
	); err != nil {
		return Endpoint{}, err
	}

	headersCopy := make(map[string]string, len(headers))
	maps.Copy(headersCopy, headers)

	return Endpoint{BaseURL: baseURL, Headers: headersCopy}, nil
}

func validateProviderBaseURL(baseURL string) error {
	if baseURL == "" || !utf8.ValidString(baseURL) {
		return ErrInvalidBaseURL
	}

	parsed, err := url.Parse(baseURL)
	if err != nil {
		return ErrInvalidBaseURL
	}

	if !parsed.IsAbs() || parsed.Opaque != "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Host == "" || parsed.Hostname() == "" || parsed.User != nil ||
		parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" ||
		strings.Contains(baseURL, "#") {
		return ErrInvalidBaseURL
	}

	return nil
}

func validateProviderHeaders(
	headers map[string]string,
	forbiddenPrefixes []string,
	forbiddenHeaders map[string]struct{},
) error {
	seen := make(map[string]struct{}, len(headers))

	for name, value := range headers {
		lowerName := strings.ToLower(name)
		if !validProviderHeaderName(name) || !validProviderHeaderValue(value) {
			return ErrInvalidHeaders
		}

		if _, ok := seen[lowerName]; ok {
			return ErrInvalidHeaders
		}

		seen[lowerName] = struct{}{}

		if reservedProviderHeader(lowerName) {
			return ErrInvalidHeaders
		}

		if _, ok := forbiddenHeaders[lowerName]; ok {
			return ErrInvalidHeaders
		}

		for _, prefix := range forbiddenPrefixes {
			if strings.HasPrefix(lowerName, prefix) {
				return ErrInvalidHeaders
			}
		}
	}

	return nil
}

func reservedProviderHeader(name string) bool {
	switch name {
	case "host", "content-length", "content-type", "accept", "connection",
		"keep-alive", "proxy-authenticate", "proxy-authorization", "te",
		"trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func validProviderHeaderName(name string) bool {
	if name == "" || !utf8.ValidString(name) {
		return false
	}

	for i := range len(name) {
		char := name[i]
		if ('a' <= char && char <= 'z') || ('A' <= char && char <= 'Z') ||
			('0' <= char && char <= '9') {
			continue
		}

		switch char {
		case '!', '#', '$', '%', '&', '\'', '*', '+', '-', '.', '^', '_', '`', '|', '~':
			continue
		default:
			return false
		}
	}

	return true
}

func validProviderHeaderValue(value string) bool {
	if !utf8.ValidString(value) {
		return false
	}

	for _, char := range value {
		if unicode.IsControl(char) {
			return false
		}
	}

	return true
}

// LogRedactions collects header values and authorization credentials, longest first.
func LogRedactions(headers map[string]string) []string {
	redactions := make([]string, 0, len(headers)+1)

	for name, value := range headers {
		if value == "" {
			continue
		}

		redactions = append(redactions, value)

		if strings.EqualFold(name, "authorization") {
			if _, credential, found := strings.Cut(value, " "); found && credential != "" {
				redactions = append(redactions, credential)
			}
		}
	}

	slices.SortFunc(redactions, func(a, b string) int {
		return cmp.Compare(len(b), len(a))
	})

	return slices.Compact(redactions)
}

// ErrorLogValue removes declared credential values from an error's log text.
func ErrorLogValue(err error, redactions []string) string {
	result := err.Error()

	for _, redaction := range redactions {
		result = strings.ReplaceAll(result, redaction, "[REDACTED]")
	}

	return result
}

// NewNoRedirectHTTPClient constructs a client that refuses all redirects.
func NewNoRedirectHTTPClient() *http.Client {
	return NewNoRedirectHTTPClientWithTransport(nil)
}

// NewNoRedirectHTTPClientWithTransport constructs a no-redirect client using
// transport, or the default transport when nil, without mutating either.
func NewNoRedirectHTTPClientWithTransport(transport http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return ErrRedirect
		},
		Jar:     nil,
		Timeout: 0,
	}
}
