// Package hasuraproxy builds the compatibility reverse proxy used to forward
// unimplemented Hasura API requests to an upstream Hasura instance.
package hasuraproxy

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

var (
	errUpstreamURLMustBeAbsolute = errors.New(
		"upstream URL must be absolute (scheme and host)",
	)
	errUpstreamURLSchemeUnsupported = errors.New(
		"upstream URL scheme must be http or https",
	)
)

// New constructs a reverse proxy for forwarding Hasura compatibility requests.
func New(rawURL string, logger *slog.Logger) (*httputil.ReverseProxy, error) {
	if logger == nil {
		logger = slog.Default()
	}

	target, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("parsing upstream URL: %w", err)
	}

	if target.Scheme == "" || target.Host == "" {
		return nil, fmt.Errorf("%w: got %q", errUpstreamURLMustBeAbsolute, rawURL)
	}

	if target.Scheme != "http" && target.Scheme != "https" {
		return nil, fmt.Errorf(
			"%w: got %q", errUpstreamURLSchemeUnsupported, target.Scheme,
		)
	}

	proxy := new(httputil.ReverseProxy)
	// Rewrite is the non-deprecated ReverseProxy hook. Before it runs,
	// ReverseProxy strips Forwarded / X-Forwarded-* from req.Out and runs
	// cleanQueryParams on req.Out.URL.RawQuery, dropping unparsable params (see
	// the httputil.ReverseProxy docs). The capture-from-req.In / restore dance
	// below and the joinRawQuery against the inbound RawQuery compensate for
	// that stripping — they are load-bearing, not redundant (removing them
	// breaks TestNewPreservesForwardedHeaders / TestNewPreservesRawQuery).
	// SetURL rewrites the target URL/path (and clears Host); the explicit Host
	// assignment keeps upstream Host-based routing pointed at Hasura; and
	// SetXForwarded appends our client IP onto the restored X-Forwarded-For.
	proxy.Rewrite = func(req *httputil.ProxyRequest) {
		forwarded := headerValues(req.In.Header, "Forwarded")
		xForwardedFor := headerValues(req.In.Header, "X-Forwarded-For")
		xForwardedHost := headerValues(req.In.Header, "X-Forwarded-Host")
		xForwardedProto := headerValues(req.In.Header, "X-Forwarded-Proto")
		inboundRawQuery := req.In.URL.RawQuery

		req.SetURL(target)
		req.Out.Host = target.Host
		req.Out.URL.RawQuery = joinRawQuery(target.RawQuery, inboundRawQuery)
		setHeaderValues(req.Out.Header, "Forwarded", forwarded)
		setHeaderValues(req.Out.Header, "X-Forwarded-For", xForwardedFor)
		req.SetXForwarded()
		setHeaderValues(req.Out.Header, "X-Forwarded-Host", xForwardedHost)
		setHeaderValues(req.Out.Header, "X-Forwarded-Proto", xForwardedProto)
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		stripCORSResponseHeaders(resp.Header)

		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		handleProxyError(w, r, err, logger)
	}

	return proxy, nil
}

func handleProxyError(
	w http.ResponseWriter,
	r *http.Request,
	err error,
	logger *slog.Logger,
) {
	// MaxBytesReader returns *http.MaxBytesError when the inbound body exceeds the
	// proxy cap. Surface that as 413 (not 502) so clients can distinguish a
	// too-large request from an upstream-unreachable failure.
	if maxBytesErr, ok := errors.AsType[*http.MaxBytesError](err); ok {
		writeRequestTooLargeResponse(w, r, maxBytesErr.Limit, logger)

		return
	}

	logger.ErrorContext(
		r.Context(),
		"failed to proxy request to hasura upstream",
		slog.String("path", r.URL.Path),
		slog.String("error", err.Error()),
	)
	w.WriteHeader(http.StatusBadGateway)
}

func writeRequestTooLargeResponse(
	w http.ResponseWriter,
	r *http.Request,
	limit int64,
	logger *slog.Logger,
) {
	logger.WarnContext(
		r.Context(),
		"proxy request body exceeded the configured limit",
		slog.String("path", r.URL.Path),
		slog.Int64("limit_bytes", limit),
	)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusRequestEntityTooLarge)

	if _, err := fmt.Fprintf(
		w,
		`{"error":"request-too-large","reason":"request body exceeds the %d-byte limit"}`,
		limit,
	); err != nil {
		logger.WarnContext(
			r.Context(),
			"failed to write proxy request body limit response",
			slog.String("path", r.URL.Path),
			slog.String("error", err.Error()),
		)
	}
}

func joinRawQuery(targetRawQuery, inboundRawQuery string) string {
	if targetRawQuery == "" || inboundRawQuery == "" {
		return targetRawQuery + inboundRawQuery
	}

	return targetRawQuery + "&" + inboundRawQuery
}

func headerValues(header http.Header, name string) []string {
	values := header.Values(name)
	if len(values) == 0 {
		return nil
	}

	return append([]string(nil), values...)
}

func setHeaderValues(header http.Header, name string, values []string) {
	if len(values) == 0 {
		return
	}

	header[http.CanonicalHeaderKey(name)] = values
}

func stripCORSResponseHeaders(header http.Header) {
	for name := range header {
		if strings.HasPrefix(strings.ToLower(name), "access-control-") {
			delete(header, name)
		}
	}
}
