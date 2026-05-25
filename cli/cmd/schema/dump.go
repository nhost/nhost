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
	"github.com/nhost/nhost/cli/nhostclient/graphql"
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
	defaultAdminSecret    = "nhost-admin-secret" //nolint:gosec
	outputFileMode        = 0o600

	headerHasuraRole        = "X-Hasura-Role"
	headerHasuraAdminSecret = "X-Hasura-Admin-Secret" //nolint:gosec
)

func commandDump() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "dump",
		Usage: "Dump a GraphQL schema as SDL",
		Description: `Emit a GraphQL schema as SDL. Source modes:

  (default)           Introspect the linked project's GraphQL endpoint.
                      Defaults to the local dev stack; pass --subdomain to
                      target a cloud project.

  --url URL           Introspect an arbitrary live GraphQL endpoint. Bypasses
                      the linked-project lookup and --subdomain.

  --metadata PATH     Load Hasura metadata from a directory and generate the
                      schema locally for --role.

The flags --url and --metadata are mutually exclusive.`,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagSubdomain,
				Usage:   "Project subdomain (defaults to the local dev stack)",
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
				Name:    flagRole,
				Usage:   "Role to generate the schema for",
				Value:   defaultRole,
				Aliases: []string{"r"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagAdminSecret,
				Usage:   "Admin secret to authenticate with (defaults to local admin secret)",
				Sources: cli.EnvVars("NHOST_ADMIN_SECRET"),
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

	resolvedURL, adminSecret, err := resolveURLAndSecret(ctx, cmd, url)
	if err != nil {
		return err
	}

	headers := buildHeaders(
		cmd.StringSlice(flagHeader), cmd.String(flagRole), adminSecret,
	)

	doc, err := dumpFromURL(ctx, cmd, resolvedURL, headers)
	if err != nil {
		return err
	}

	return writeSDL(doc, cmd.String(flagOutput))
}

func resolveURLAndSecret(
	ctx context.Context, cmd *cli.Command, url string,
) (string, string, error) {
	adminSecret := cmd.String(flagAdminSecret)

	if url != "" {
		return url, adminSecret, nil
	}

	ce := clienv.FromCLI(cmd)
	subdomain := cmd.String(flagSubdomain)
	local := ce.LocalSubdomain()

	if subdomain == "" || subdomain == local {
		if adminSecret == "" {
			adminSecret = defaultAdminSecret
		}

		return fmt.Sprintf("https://%s.graphql.%s.nhost.run/v1", local, local), adminSecret, nil
	}

	proj, err := ce.GetAppInfo(ctx, subdomain)
	if err != nil {
		return "", "", fmt.Errorf("failed to get app info: %w", err)
	}

	return projectGraphqlURL(proj), adminSecret, nil
}

func projectGraphqlURL(proj *graphql.AppSummaryFragment) string {
	return fmt.Sprintf(
		"https://%s.graphql.%s.nhost.run/v1", proj.Subdomain, proj.Region.Name,
	)
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
