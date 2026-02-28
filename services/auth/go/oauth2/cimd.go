package oauth2

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	CIMDMaxResponseSize = 5 * 1024
	CIMDFetchTimeout    = 5 * time.Second
	CIMDCacheTTL        = 1 * time.Hour
	schemeHTTPS         = "https"
)

var (
	errPrivateIP   = errors.New("resolved IP is a private/loopback address")
	errTooManyRdir = errors.New("too many redirects")
	errNonHTTPS    = errors.New("redirect to non-HTTPS URL")
)

type CIMDMetadata struct {
	ClientID                string   `json:"client_id"`
	RedirectURIs            []string `json:"redirect_uris"`
	Scope                   string   `json:"scope"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`

	// Prohibited fields - must not be present
	ClientSecret          *string `json:"client_secret"`            //nolint:tagliatelle
	ClientSecretExpiresAt *int    `json:"client_secret_expires_at"` //nolint:tagliatelle
}

func IsCIMDClientID(clientID string, allowInsecure bool) bool {
	u, err := url.Parse(clientID)
	if err != nil {
		return false
	}

	validScheme := u.Scheme == schemeHTTPS || (allowInsecure && u.Scheme == "http")

	return validScheme && u.Host != "" && u.Path != "" && u.Path != "/"
}

func ValidateCIMDURL( //nolint:cyclop
	ctx context.Context, clientID string, allowInsecure bool,
) (*url.URL, *Error) {
	u, err := url.Parse(clientID)
	if err != nil {
		return nil, &Error{Err: "invalid_client", Description: "Invalid client_id URL"}
	}

	validScheme := u.Scheme == schemeHTTPS || (allowInsecure && u.Scheme == "http")
	if !validScheme {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must use HTTPS",
		}
	}

	if u.Path == "" || u.Path == "/" {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must have a path",
		}
	}

	if u.Fragment != "" {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must not have a fragment",
		}
	}

	if u.User != nil {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must not have credentials",
		}
	}

	if hasDotSegments(u.Path) {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must not contain dot segments",
		}
	}

	if !allowInsecure && isPrivateOrLoopback(ctx, u.Hostname()) {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID metadata document URL must not point to a private address",
		}
	}

	return u, nil
}

func hasDotSegments(path string) bool {
	return strings.Contains(path, "/./") ||
		strings.Contains(path, "/../") ||
		strings.HasSuffix(path, "/.") ||
		strings.HasSuffix(path, "/..")
}

func isPrivateOrLoopback(ctx context.Context, host string) bool { //nolint:cyclop
	ip := net.ParseIP(host)
	if ip != nil {
		return ip.IsLoopback() || ip.IsPrivate() ||
			ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast()
	}

	resolver := net.DefaultResolver

	// Resolve hostnames so that e.g. "localhost" is correctly detected.
	ips, err := resolver.LookupIPAddr(ctx, host)
	if err != nil {
		return false
	}

	for _, resolved := range ips {
		if resolved.IP.IsLoopback() || resolved.IP.IsPrivate() ||
			resolved.IP.IsLinkLocalUnicast() || resolved.IP.IsLinkLocalMulticast() {
			return true
		}
	}

	return false
}

func FetchCIMDMetadata(
	ctx context.Context,
	httpClient *http.Client,
	clientIDURL string,
	logger *slog.Logger,
) (*CIMDMetadata, *Error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, clientIDURL, nil)
	if err != nil {
		logger.ErrorContext(ctx, "error creating CIMD request", logError(err))
		return nil, &Error{Err: "server_error", Description: "Internal server error"}
	}

	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		logger.WarnContext(
			ctx, "error fetching CIMD metadata", slog.String("url", clientIDURL), logError(err),
		)

		return nil, &Error{
			Err:         "invalid_client",
			Description: "Failed to fetch client metadata document",
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.WarnContext(
			ctx,
			"CIMD metadata fetch returned non-200 status",
			slog.String("url", clientIDURL),
			slog.Int("status", resp.StatusCode),
		)

		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client metadata document returned non-200 status",
		}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, CIMDMaxResponseSize+1))
	if err != nil {
		logger.WarnContext(ctx, "error reading CIMD response body", logError(err))

		return nil, &Error{
			Err:         "invalid_client",
			Description: "Failed to read client metadata document",
		}
	}

	if len(body) > CIMDMaxResponseSize {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client metadata document exceeds maximum size",
		}
	}

	metadata, oauthErr := parseCIMDMetadata(body, clientIDURL, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	return metadata, nil
}

func validateRedirectURIOrigins(
	clientIDURL string, redirectURIs []string, logger *slog.Logger,
) *Error {
	clientURL, err := url.Parse(clientIDURL)
	if err != nil {
		return &Error{
			Err:         "invalid_client",
			Description: "Invalid client_id URL",
		}
	}

	clientOrigin := clientURL.Scheme + "://" + clientURL.Host

	for _, redirectURI := range redirectURIs {
		ru, err := url.Parse(redirectURI)
		if err != nil || ru.Scheme+"://"+ru.Host != clientOrigin {
			logger.Warn(
				"CIMD redirect_uri origin does not match client_id",
				slog.String("client_id", clientIDURL),
				slog.String("redirect_uri", redirectURI),
			)

			return &Error{
				Err:         "invalid_client",
				Description: "redirect_uri must be on the same origin as the client_id",
			}
		}
	}

	return nil
}

func parseCIMDMetadata(
	body []byte, clientIDURL string, logger *slog.Logger,
) (*CIMDMetadata, *Error) {
	var metadata CIMDMetadata
	if err := json.Unmarshal(body, &metadata); err != nil {
		logger.Warn("error parsing CIMD metadata", logError(err))

		return nil, &Error{
			Err:         "invalid_client",
			Description: "Invalid client metadata document JSON",
		}
	}

	if metadata.ClientID != clientIDURL {
		logger.Warn(
			"CIMD client_id mismatch",
			slog.String("expected", clientIDURL),
			slog.String("actual", metadata.ClientID),
		)

		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client ID in metadata does not match the URL",
		}
	}

	if metadata.ClientSecret != nil || metadata.ClientSecretExpiresAt != nil {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client metadata document must not contain client_secret fields",
		}
	}

	if len(metadata.RedirectURIs) == 0 {
		return nil, &Error{
			Err:         "invalid_client",
			Description: "Client metadata document must contain at least one redirect_uri",
		}
	}

	if oauthErr := validateRedirectURIOrigins(
		clientIDURL,
		metadata.RedirectURIs,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	return &metadata, nil
}

func (p *Provider) ResolveCIMDClient( //nolint:cyclop
	ctx context.Context,
	clientID string,
	logger *slog.Logger,
) (sql.AuthOauth2Client, *Error) {
	clientIDURL, oauthErr := ValidateCIMDURL(
		ctx, clientID, p.config.CIMDAllowInsecureTransport,
	)
	if oauthErr != nil {
		return sql.AuthOauth2Client{}, oauthErr //nolint:exhaustruct
	}

	existing, err := p.db.GetOAuth2ClientByClientID(ctx, clientID)
	if err == nil &&
		existing.Type == sql.OAuth2ClientTypeCIMD &&
		existing.MetadataDocumentFetchedAt.Valid &&
		time.Since(existing.MetadataDocumentFetchedAt.Time) < CIMDCacheTTL {
		return existing, nil
	}

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		logger.ErrorContext(ctx, "error looking up CIMD client", logError(err))

		return sql.AuthOauth2Client{}, &Error{ //nolint:exhaustruct
			Err: "server_error", Description: "Internal server error",
		}
	}

	metadata, oauthErr := FetchCIMDMetadata(
		ctx, p.httpClient, clientIDURL.String(), logger,
	)
	if oauthErr != nil {
		return sql.AuthOauth2Client{}, oauthErr //nolint:exhaustruct
	}

	scopes := DefaultScopes()
	if metadata.Scope != "" {
		scopes = strings.Split(metadata.Scope, " ")

		if msg := p.validateScopes(scopes); msg != "" {
			logger.WarnContext(
				ctx,
				"CIMD metadata contains invalid scope",
				slog.String("scope", metadata.Scope),
			)

			return sql.AuthOauth2Client{}, &Error{ //nolint:exhaustruct
				Err:         "invalid_scope",
				Description: msg,
			}
		}
	}

	client, err := p.db.UpsertOAuth2CIMDClient(ctx, sql.UpsertOAuth2CIMDClientParams{
		ClientID:     clientID,
		RedirectUris: metadata.RedirectURIs,
		Scopes:       scopes,
	})
	if err != nil {
		logger.ErrorContext(
			ctx,
			"error upserting CIMD client",
			logError(err),
		)

		return sql.AuthOauth2Client{}, &Error{ //nolint:exhaustruct
			Err: "server_error", Description: "Internal server error",
		}
	}

	return client, nil
}

func newSafeHTTPClient() *http.Client {
	dialer := &net.Dialer{ //nolint:exhaustruct
		Timeout: CIMDFetchTimeout,
	}

	transport := &http.Transport{ //nolint:exhaustruct
		DialContext: func(
			ctx context.Context, network, addr string,
		) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, fmt.Errorf("invalid address: %w", err)
			}

			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, fmt.Errorf("DNS lookup failed: %w", err)
			}

			for _, ip := range ips {
				if ip.IP.IsLoopback() || ip.IP.IsPrivate() ||
					ip.IP.IsLinkLocalUnicast() || ip.IP.IsLinkLocalMulticast() {
					return nil, fmt.Errorf(
						"%w: %s", errPrivateIP, ip.IP.String(),
					)
				}
			}

			return dialer.DialContext(
				ctx, network, net.JoinHostPort(ips[0].IP.String(), port),
			)
		},
	}

	return &http.Client{ //nolint:exhaustruct
		Transport: transport,
		Timeout:   CIMDFetchTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			const maxRedirects = 3
			if len(via) >= maxRedirects {
				return fmt.Errorf("%w (max %d)", errTooManyRdir, maxRedirects)
			}

			if req.URL.Scheme != schemeHTTPS {
				return fmt.Errorf("%w: %s", errNonHTTPS, req.URL.String())
			}

			return nil
		},
	}
}

// newInsecureHTTPClient creates an HTTP client without SSRF protections.
// For development/testing only (e.g., Docker Compose demos with private IPs).
func newInsecureHTTPClient() *http.Client {
	return &http.Client{ //nolint:exhaustruct
		Transport: &http.Transport{ //nolint:exhaustruct
			TLSClientConfig: &tls.Config{ //nolint:exhaustruct
				MinVersion:         tls.VersionTLS12,
				InsecureSkipVerify: true, //nolint:gosec
			},
		},
		Timeout: CIMDFetchTimeout,
	}
}
