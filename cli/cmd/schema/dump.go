package schema //nolint:revive,nolintlint

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

const (
	flagURL          = "url"
	flagMetadataPath = "metadata"
	flagRole         = "role"
	flagHeader       = "header"
	flagOutput       = "output"
	flagTimeout      = "timeout"
	flagSubdomain    = "subdomain"
	flagAdminSecret  = "admin-secret"

	defaultTimeoutSeconds = 30
	defaultRole           = "user"
	outputFileMode        = 0o600

	headerHasuraRole        = "X-Hasura-Role"
	headerHasuraAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec // HTTP header name, not a credential
)

func commandDump() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "dump",
		Usage: "Dump a GraphQL schema as SDL",
		Description: `Emit a GraphQL schema as SDL. Source modes:

  (default)           Introspect the linked project's GraphQL endpoint. With
                      no --subdomain the linked project is used (links if
                      needed). Pass --subdomain local for the local dev
                      stack, or --subdomain <name> for a specific cloud
                      project. For cloud projects the admin secret is fetched
                      via the Nhost API unless --admin-secret is set.

  --url URL           Introspect an arbitrary live GraphQL endpoint. Bypasses
                      the linked-project lookup and --subdomain.

  --metadata PATH     Load Hasura metadata from a directory and generate the
                      schema locally for --role.

The flags --url and --metadata are mutually exclusive.`,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Project subdomain (defaults to the linked project; use 'local' for the local dev stack)",
				Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagURL,
				Usage:   "GraphQL endpoint URL to introspect",
				Aliases: []string{"u"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagMetadataPath,
				Usage:   "Path to a Hasura metadata directory to generate the schema from",
				Aliases: []string{"m"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name: flagRole,
				Usage: "Role to generate the schema for. Metadata mode defaults to " +
					"\"user\"; URL mode sends X-Hasura-Role only when this flag is " +
					"explicitly set.",
				Value:   defaultRole,
				Aliases: []string{"r"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name: flagAdminSecret,
				Usage: "Admin secret (defaults: local subdomain → nhost-admin-secret;" +
					" cloud → fetched from Nhost API). NHOST_ADMIN_SECRET is consulted" +
					" only when --url is not set and never forwarded to --url.",
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:    flagHeader,
				Usage:   `Extra HTTP header to send, repeatable (e.g. "X-Hasura-Foo: bar")`,
				Aliases: []string{"H"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagOutput,
				Usage:   "Output file (default: stdout)",
				Aliases: []string{"o"},
			},
			&cli.IntFlag{ //nolint:exhaustruct
				Name:  flagTimeout,
				Usage: "HTTP timeout in seconds (URL mode only)",
				Value: defaultTimeoutSeconds,
			},
		},
		Action: dump,
	}
}

func dump(ctx context.Context, cmd *cli.Command) error {
	metadataPath := cmd.String(flagMetadataPath)
	url := cmd.String(flagURL)

	if metadataPath != "" && url != "" {
		return cli.Exit("--url and --metadata are mutually exclusive", 1)
	}

	if metadataPath != "" {
		doc, err := dumpFromMetadata(ctx, metadataPath, cmd.String(flagRole))
		if err != nil {
			return err
		}

		return writeSDL(doc, cmd.String(flagOutput))
	}

	resolvedURL, adminSecret, err := resolveURLAndSecret(
		ctx,
		clienv.FromCLI(cmd),
		cmd.String(flagSubdomain),
		url,
		cmd.String(flagAdminSecret),
		cmd.IsSet(flagAdminSecret),
	)
	if err != nil {
		return err
	}

	role := ""
	if cmd.IsSet(flagRole) {
		role = cmd.String(flagRole)
	}

	headers := buildHeaders(cmd.StringSlice(flagHeader), role, adminSecret)

	doc, err := dumpFromURL(ctx, cmd, resolvedURL, headers)
	if err != nil {
		return err
	}

	return writeSDL(doc, cmd.String(flagOutput))
}

// resolveURLAndSecret returns the GraphQL endpoint URL and the admin secret to
// attach to it. When the user passes --url, only the explicit --admin-secret
// flag is forwarded — NHOST_ADMIN_SECRET is intentionally not auto-applied so
// that a developer with the env var exported for their own project does not
// silently leak it to an arbitrary third-party endpoint. When --url is not
// set (linked-project, --subdomain local, or --subdomain <cloud-project>) the
// env var is honoured as an override unless the user explicitly passed
// --admin-secret (including with an empty value).
//
// Parameters are passed explicitly (rather than via *cli.Command) so the
// security-sensitive precedence policy can be exercised by table-driven tests
// without standing up a urfave/cli command tree.
func resolveURLAndSecret(
	ctx context.Context,
	ce *clienv.CliEnv,
	subdomain string,
	url string,
	adminSecret string,
	explicitSecret bool,
) (string, string, error) {
	if url != "" {
		// Explicit --url: only forward the admin secret when the user typed it
		// in via --admin-secret; never from NHOST_ADMIN_SECRET (which the flag
		// no longer auto-reads).
		return url, adminSecret, nil
	}

	ep, err := ce.ResolveProject(ctx, subdomain)
	if err != nil {
		return "", "", fmt.Errorf("failed to resolve project: %w", err)
	}

	// An explicit --admin-secret (including the empty string) wins outright:
	// return immediately, bypassing both the NHOST_ADMIN_SECRET env-var
	// fallback and the lazy cloud-API fetch in ep.AdminSecret.
	if explicitSecret {
		return ep.GraphqlURL, adminSecret, nil
	}

	// When --url is not set the env var is a safe override: we are talking to
	// a project resolved via --subdomain (the linked project, the local stack,
	// or a named cloud project), not an arbitrary third-party endpoint.
	adminSecret = os.Getenv("NHOST_ADMIN_SECRET")
	if adminSecret != "" {
		ep.SetAdminSecret(adminSecret)
	}

	adminSecret, err = ep.AdminSecret(ctx)
	if err != nil {
		return "", "", fmt.Errorf("failed to get admin secret: %w", err)
	}

	return ep.GraphqlURL, adminSecret, nil
}

// buildHeaders combines derived defaults (role, admin secret) with explicit
// -H entries. Explicit -H entries come last so they win on duplicate keys.
func buildHeaders(extra []string, role, adminSecret string) []string {
	headers := make([]string, 0, len(extra)+2) //nolint:mnd

	if role != "" {
		headers = append(headers, headerHasuraRole+": "+role)
	}

	if adminSecret != "" {
		headers = append(headers, headerHasuraAdminSecret+": "+adminSecret)
	}

	return append(headers, extra...)
}

func dumpFromURL(
	ctx context.Context, cmd *cli.Command, url string, rawHeaders []string,
) (*ast.SchemaDocument, error) {
	headers, err := parseHeaders(rawHeaders)
	if err != nil {
		return nil, cli.Exit(fmt.Sprintf("invalid header: %v", err), 1)
	}

	doer := &http.Client{ //nolint:exhaustruct
		Timeout: time.Duration(cmd.Int(flagTimeout)) * time.Second,
	}

	schema, err := remoteschema.Introspect(ctx, url, headers, doer)
	if err != nil {
		return nil, cli.Exit(fmt.Sprintf("introspection failed: %v", err), 1)
	}

	return schema.ToAST(), nil
}

func dumpFromMetadata(
	ctx context.Context, metadataPath, role string,
) (*ast.SchemaDocument, error) {
	meta, err := metadata.FromDetect(ctx, metadataPath)
	if err != nil {
		return nil, cli.Exit(fmt.Sprintf("failed to load metadata: %v", err), 1)
	}

	built, err := connector.BuildConnectorsFromMetadata(ctx, meta, slog.Default())
	if err != nil {
		return nil, cli.Exit(
			fmt.Sprintf("failed to build connectors from metadata: %v", err), 1,
		)
	}

	defer func() {
		for _, c := range built.Connectors {
			c.Close()
		}
	}()

	schema, exists := built.SchemaDocs[role]
	if !exists {
		availableRoles := make([]string, 0, len(built.SchemaDocs))
		for r := range built.SchemaDocs {
			availableRoles = append(availableRoles, r)
		}

		sort.Strings(availableRoles)

		return nil, cli.Exit(
			fmt.Sprintf("role %q not found. Available roles: %v", role, availableRoles), 1,
		)
	}

	return schema, nil
}

func writeSDL(doc *ast.SchemaDocument, outputPath string) error {
	var buf bytes.Buffer

	f := formatter.NewFormatter(&buf, formatter.WithIndent("  "))
	f.FormatSchemaDocument(doc)

	if outputPath != "" {
		if err := os.WriteFile(outputPath, buf.Bytes(), outputFileMode); err != nil {
			return cli.Exit("failed to write output: "+err.Error(), 1)
		}

		return nil
	}

	if _, err := os.Stdout.Write(buf.Bytes()); err != nil {
		return cli.Exit("failed to write output: "+err.Error(), 1)
	}

	return nil
}

func parseHeaders(raw []string) (map[string]string, error) {
	headers := make(map[string]string, len(raw))

	for _, h := range raw {
		name, value, ok := strings.Cut(h, ":")
		if !ok {
			return nil, fmt.Errorf("missing ':' separator in %q", h) //nolint:err113
		}

		name = strings.TrimSpace(name)
		if name == "" {
			return nil, fmt.Errorf("empty header name in %q", h) //nolint:err113
		}

		headers[name] = strings.TrimSpace(value)
	}

	return headers, nil
}
