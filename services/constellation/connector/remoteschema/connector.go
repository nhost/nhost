// Package remoteschema implements the Connector interface for remote GraphQL
// schema data sources. It introspects remote endpoints, generates role-based
// schemas with @preset directive support, and forwards operations.
//
// The HTTP boundary is hidden behind the HTTPDoer interface so unit tests in
// this package can mock the wire entirely (see the mock/ subpackage). The
// end-to-end contract against a real remote endpoint is exercised by the
// integration suite (integration/misc_remote_schema_test.go), which boots a
// live Nhost dev environment and runs full introspection-plus-execute paths
// through New + Connector.Execute.
package remoteschema

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

const defaultTimeoutSeconds = 60

// validateRemoteURL rejects a resolved remote-schema endpoint whose scheme is
// not http/https or that has no host. This is a construction-time guard so a
// misconfigured (or maliciously crafted) URL — e.g. a file:// or scheme-less
// target — cannot reach the outbound HTTP path.
//
// Deliberately NOT blocked: loopback/link-local/internal hosts (localhost,
// 127.0.0.1, 169.254.169.254, *.internal). The URL is admin-authored metadata
// (meta.Definition.URL, resolved by the caller), not attacker input, so the
// admin-only trust boundary makes full SSRF host-filtering unnecessary here. If
// remote-schema URLs ever become sourceable from a less-trusted place, this
// guard must be extended to reject internal hosts.
func validateRemoteURL(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("parsing URL: %w", err)
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%w %q (want http or https)", ErrUnsupportedURLScheme, parsed.Scheme)
	}

	if parsed.Host == "" {
		return fmt.Errorf("%w: %q", ErrURLMissingHost, raw)
	}

	return nil
}

// Connector is the remote schema data source. It introspects the remote GraphQL
// endpoint, generates role-based schemas (admin via live introspection, other
// roles from SDL in metadata), and forwards operations to the remote endpoint.
type Connector struct {
	name                 string
	forwardClientHeaders bool
	schemas              map[string]*graph.Schema          // role -> schema
	presets              map[string]map[string][]presetArg // role -> "TypeName.fieldName" -> presets
	httpClient           *httpClient
}

// New creates a new remote schema connector from metadata. The provided doer is
// used for all HTTP traffic, including the admin introspection request made
// during construction. Passing nil falls back to a default *http.Client whose
// timeout is taken from meta.Definition.TimeoutSeconds.
func New(
	ctx context.Context,
	meta *metadata.RemoteSchemaMetadata,
	doer HTTPDoer,
) (*Connector, error) {
	timeout := meta.Definition.TimeoutSeconds
	if timeout <= 0 {
		timeout = defaultTimeoutSeconds
	}

	url, err := meta.Definition.URL.Resolve()
	if err != nil {
		return nil, fmt.Errorf("resolving remote schema URL for %s: %w", meta.Name, err)
	}

	if err := validateRemoteURL(url); err != nil {
		return nil, fmt.Errorf("validating remote schema URL for %s: %w", meta.Name, err)
	}

	headers, err := buildHeaders(meta)
	if err != nil {
		return nil, fmt.Errorf("building headers for remote schema %s: %w", meta.Name, err)
	}

	// The redirect hardening below is attached only to the default client. A
	// caller-supplied doer is responsible for its own redirect policy, so this
	// protection holds only because production always passes a nil doer (the
	// WithHTTPDoer/WithRemoteSchemaFactory options have no non-test callers).
	// Wiring an injected doer into production must re-establish this guard, or
	// redirects would silently leak the configured credentials.
	if doer == nil {
		doer = &http.Client{ //nolint:exhaustruct
			Timeout: time.Duration(timeout) * time.Second,
			// Disallow redirect following entirely. A GraphQL operation is a
			// POST with no legitimate redirect semantics, and following one
			// would re-issue the request — with the configured X-Api-Key and
			// any forwarded Authorization/Cookie headers — to an
			// attacker-chosen host (SSRF + credential leak). Returning
			// http.ErrUseLastResponse makes Do() stop at the first 3xx and
			// hand it back so the caller treats it as a non-200 response.
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}

	schemas, presets, err := buildRoleSchemas(meta)
	if err != nil {
		return nil, fmt.Errorf("building role schemas for remote schema %s: %w", meta.Name, err)
	}

	connector := &Connector{
		name:                 meta.Name,
		forwardClientHeaders: meta.Definition.ForwardClientHeaders,
		schemas:              schemas,
		presets:              presets,
		httpClient: &httpClient{
			url:     url,
			headers: headers,
			client:  doer,
		},
	}

	// Admin role always has full access via introspection.
	adminSchema, err := connector.introspectRemoteSchema(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect remote schema for admin role: %w", err)
	}

	connector.schemas[metadata.RoleAdmin] = adminSchema

	return connector, nil
}

// buildHeaders resolves the configured headers from a remote schema definition.
func buildHeaders(meta *metadata.RemoteSchemaMetadata) (map[string]string, error) {
	headers := make(map[string]string, len(meta.Definition.Headers))

	for _, h := range meta.Definition.Headers {
		value, err := h.Value.Resolve()
		if err != nil {
			return nil, fmt.Errorf(
				"resolving header %q for remote schema %s: %w", h.Name, meta.Name, err,
			)
		}

		headers[h.Name] = value
	}

	return headers, nil
}

// buildRoleSchemas parses the SDL permission blocks for every non-admin role,
// returning per-role schemas and the preset registry. Admin is intentionally
// skipped — the live introspection result is the source of truth for admin.
func buildRoleSchemas(
	meta *metadata.RemoteSchemaMetadata,
) (map[string]*graph.Schema, map[string]map[string][]presetArg, error) {
	schemas := make(map[string]*graph.Schema)
	presets := make(map[string]map[string][]presetArg)

	for _, perm := range meta.Permissions {
		if perm.Role == metadata.RoleAdmin {
			continue
		}

		schema, rolePresets, err := parseSDL(perm.Definition.Schema)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to parse schema for role %s: %w", perm.Role, err)
		}

		schemas[perm.Role] = schema

		if len(rolePresets) > 0 {
			presets[perm.Role] = rolePresets
		}
	}

	return schemas, presets, nil
}

// GetSchema returns the parsed schemas for each role.
func (c *Connector) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, nil
}

// GetTypeName returns the base GraphQL return type for a query field name
// (e.g. "countries" -> "Country"). Returns empty string if the field is not
// found. Lookups go through the admin schema, which New always populates from
// the live introspection result.
func (c *Connector) GetTypeName(identifier string) string {
	schema, ok := c.schemas[metadata.RoleAdmin]
	if !ok || schema == nil {
		return ""
	}

	if schema.QueryType == nil {
		return ""
	}

	for _, t := range schema.Types {
		if t.Name != *schema.QueryType {
			continue
		}

		for _, field := range t.Fields {
			if field.Name == identifier {
				return graphBaseTypeName(field.Type)
			}
		}
	}

	return ""
}

func (c *Connector) roleRootTypeName(role string, operation ast.Operation) string {
	schema := c.schemas[role]
	if schema == nil {
		return defaultRootTypeName(operation)
	}

	switch operation {
	case ast.Query:
		if schema.QueryType != nil {
			return *schema.QueryType
		}
	case ast.Mutation:
		if schema.MutationType != nil {
			return *schema.MutationType
		}
	case ast.Subscription:
		if schema.SubscriptionType != nil {
			return *schema.SubscriptionType
		}
	}

	return defaultRootTypeName(operation)
}

// Close releases connector-owned resources. Currently a no-op because the
// remote schema connector borrows its HTTP transport from the caller and
// holds no other state requiring shutdown.
func (c *Connector) Close() {}

// Execute forwards a GraphQL operation to the remote endpoint.
// The planner handles relationship detection, AST transformation, and phantom field injection.
func (c *Connector) Execute(
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	rootTypeName := ""
	if operation != nil {
		rootTypeName = c.roleRootTypeName(role, operation.Operation)
	}

	modifiedOp, modifiedFragments := applyPresetsToDocument(
		operation,
		fragments,
		c.presets[role],
		sessionVariables,
		rootTypeName,
	)
	query := buildQueryString(modifiedOp, modifiedFragments)

	var clientHeaders http.Header
	if c.forwardClientHeaders {
		clientHeaders = requestcontext.ClientHeadersFromContext(ctx)
	}

	result, err := c.executeRemoteQuery(
		ctx,
		query,
		variables,
		sessionVariables,
		clientHeaders,
		logger,
	)
	if err != nil {
		return result, fmt.Errorf("executing remote query for %s: %w", c.name, err)
	}

	return result, nil
}

// ValidateOperation is a no-op for remote schemas: there is no client-side
// argument validation that can be performed before forwarding, since the remote
// endpoint owns validation and reports failures during Execute. It returns nil
// to satisfy the connector.Connector pre-execution-validation contract without
// claiming to detect anything.
func (c *Connector) ValidateOperation(
	_ *ast.OperationDefinition,
	_ ast.FragmentDefinitionList,
	_ map[string]any,
	_ string,
	_ map[string]any,
) error {
	return nil
}
