package provider

import (
	"errors"
	"maps"
	"net/http"
	"net/url"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	errInvalidProviderBaseURL = errors.New("invalid provider base URL")
	errInvalidProviderHeaders = errors.New("invalid provider headers")
	errProviderRedirect       = errors.New("provider redirects are not allowed")
)

type endpointConfiguration struct {
	baseURL string
	headers map[string]string
}

func newEndpointConfiguration(
	baseURL string,
	headers map[string]string,
	validateAdapterURL func(string) error,
	forbiddenHeaderPrefixes []string,
	forbiddenHeaders map[string]struct{},
) (endpointConfiguration, error) {
	if err := validateProviderBaseURL(baseURL); err != nil {
		return endpointConfiguration{}, err
	}

	if err := validateAdapterURL(baseURL); err != nil {
		return endpointConfiguration{}, err
	}

	if err := validateProviderHeaders(
		headers,
		forbiddenHeaderPrefixes,
		forbiddenHeaders,
	); err != nil {
		return endpointConfiguration{}, err
	}

	headersCopy := make(map[string]string, len(headers))
	maps.Copy(headersCopy, headers)

	return endpointConfiguration{baseURL: baseURL, headers: headersCopy}, nil
}

func validateProviderBaseURL(baseURL string) error {
	if baseURL == "" || !utf8.ValidString(baseURL) {
		return errInvalidProviderBaseURL
	}

	parsed, err := url.Parse(baseURL)
	if err != nil {
		return errInvalidProviderBaseURL
	}

	if !parsed.IsAbs() || parsed.Opaque != "" ||
		(parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.Host == "" || parsed.Hostname() == "" || parsed.User != nil ||
		parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" ||
		strings.Contains(baseURL, "#") {
		return errInvalidProviderBaseURL
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
			return errInvalidProviderHeaders
		}

		if _, ok := seen[lowerName]; ok {
			return errInvalidProviderHeaders
		}

		seen[lowerName] = struct{}{}

		if reservedProviderHeader(lowerName) {
			return errInvalidProviderHeaders
		}

		if _, ok := forbiddenHeaders[lowerName]; ok {
			return errInvalidProviderHeaders
		}

		for _, prefix := range forbiddenPrefixes {
			if strings.HasPrefix(lowerName, prefix) {
				return errInvalidProviderHeaders
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

func newNoRedirectHTTPClient() *http.Client {
	return newNoRedirectHTTPClientWithTransport(nil)
}

func newNoRedirectHTTPClientWithTransport(transport http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errProviderRedirect
		},
		Jar:     nil,
		Timeout: 0,
	}
}
