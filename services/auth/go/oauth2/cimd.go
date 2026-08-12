package oauth2

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/safehttp"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const (
	CIMDMaxResponseSize = 5 * 1024
	CIMDFetchTimeout    = 5 * time.Second
	CIMDCacheTTL        = 1 * time.Hour
	schemeHTTPS         = "https"
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

func ValidateCIMDURL(
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

	// safehttp owns the address policy — the client that fetches this document
	// applies it again at dial time, which is the enforcement point. This
	// pre-flight call exists only to turn a denied address into a specific
	// error instead of a generic fetch failure, so it must apply the same
	// policy rather than a second, weaker copy of it.
	if !allowInsecure && safehttp.IsDeniedHost(ctx, u.Hostname()) {
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

	metadata, oauthErr := parseCIMDMetadata(ctx, body, clientIDURL, logger)
	if oauthErr != nil {
		return nil, oauthErr
	}

	return metadata, nil
}

// matchRedirectURI checks if redirectURI matches any of the registered URIs.
// For loopback URIs (localhost, 127.0.0.1, [::1]), the port is ignored per
// RFC 8252 Section 7.3 — the authorization server MUST allow any port.
func matchRedirectURI(redirectURI string, registered []string) bool {
	ru, err := url.Parse(redirectURI)
	if err != nil {
		return false
	}

	for _, reg := range registered {
		regURL, err := url.Parse(reg)
		if err != nil {
			continue
		}

		if ru.Scheme == regURL.Scheme &&
			ru.Hostname() == regURL.Hostname() &&
			ru.Path == regURL.Path &&
			(ru.Port() == regURL.Port() || isLoopbackHost(ru.Hostname())) {
			return true
		}
	}

	return false
}

func isLoopbackHost(host string) bool {
	ip := net.ParseIP(host)
	if ip != nil {
		return ip.IsLoopback()
	}

	return host == "localhost"
}

func isLoopbackRedirectURI(ctx context.Context, redirectURI *url.URL) bool {
	host := redirectURI.Hostname()

	ip := net.ParseIP(host)
	if ip != nil {
		return ip.IsLoopback()
	}

	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return false
	}

	for _, resolved := range ips {
		if resolved.IP.IsLoopback() {
			return true
		}
	}

	return false
}

func validateRedirectURIOrigins(
	ctx context.Context, clientIDURL string, redirectURIs []string, logger *slog.Logger,
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
		if err != nil {
			logger.Warn(
				"CIMD redirect_uri is invalid",
				slog.String("client_id", clientIDURL),
				slog.String("redirect_uri", redirectURI),
			)

			return &Error{
				Err:         "invalid_client",
				Description: "redirect_uri is invalid",
			}
		}

		// Per RFC 8252 (OAuth 2.0 for Native Apps) and the MCP authorization
		// spec, loopback redirect URIs (localhost, 127.0.0.1, [::1]) are
		// allowed for native/CLI clients regardless of client_id origin.
		if isLoopbackRedirectURI(ctx, ru) {
			continue
		}

		if ru.Scheme+"://"+ru.Host != clientOrigin {
			logger.Warn(
				"CIMD redirect_uri origin does not match client_id",
				slog.String("client_id", clientIDURL),
				slog.String("redirect_uri", redirectURI),
			)

			return &Error{
				Err:         "invalid_client",
				Description: "redirect_uri must be on the same origin as the client_id or use a loopback address",
			}
		}
	}

	return nil
}

func parseCIMDMetadata(
	ctx context.Context, body []byte, clientIDURL string, logger *slog.Logger,
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
		ctx,
		clientIDURL,
		metadata.RedirectURIs,
		logger,
	); oauthErr != nil {
		return nil, oauthErr
	}

	return &metadata, nil
}

func (p *Provider) ResolveCIMDClient(
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
