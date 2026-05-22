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

	defaultTimeoutSeconds = 30
	defaultRole           = "user"
	outputFileMode        = 0o600
)

func commandDump() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "dump",
		Usage: "Dump a GraphQL schema as SDL from a live endpoint or metadata",
		Description: `Emit a GraphQL schema as SDL. Two source modes:

  --url URL           Introspect a live GraphQL endpoint. Drop-in replacement
                      for "rover graph introspect" (pass the role via
                      -H "X-Hasura-Role: ...").

  --metadata PATH     Load metadata from a directory and generate the schema
                      locally for the given --role (default: user).

Exactly one of --url or --metadata must be set.`,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagURL,
				Usage:   "GraphQL endpoint URL to introspect",
				Aliases: []string{"u"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagMetadataPath,
				Usage:   "Path to a metadata directory to generate the schema from",
				Aliases: []string{"m"},
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagRole,
				Usage:   "Role to generate schema for (metadata mode only)",
				Value:   defaultRole,
				Aliases: []string{"r"},
			},
			&cli.StringSliceFlag{ //nolint:exhaustruct
				Name:    flagHeader,
				Usage:   `Extra HTTP header to send, repeatable (e.g. "X-Hasura-Role: admin"). URL mode only`,
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
	url := cmd.String(flagURL)
	metadataPath := cmd.String(flagMetadataPath)

	if (url == "") == (metadataPath == "") {
		return cli.Exit("exactly one of --url or --metadata must be set", 1)
	}

	var (
		doc *ast.SchemaDocument
		err error
	)

	if url != "" {
		doc, err = dumpFromURL(ctx, cmd, url)
	} else {
		doc, err = dumpFromMetadata(ctx, metadataPath, cmd.String(flagRole))
	}

	if err != nil {
		return err
	}

	return writeSDL(doc, cmd.String(flagOutput))
}

func dumpFromURL(ctx context.Context, cmd *cli.Command, url string) (*ast.SchemaDocument, error) {
	headers, err := parseHeaders(cmd.StringSlice(flagHeader))
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
