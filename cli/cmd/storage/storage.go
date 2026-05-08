package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
	"github.com/urfave/cli/v3"
)

const (
	flagSubdomain   = "subdomain"
	flagAdminSecret = "admin-secret"
	flagHTTPPort    = "http-port"
	flagDisableTLS  = "disable-tls"
	flagDir         = "dir"

	defaultBucket = "default"
	dirPerm       = 0o755
	httpsPort     = 443

	adminSecretHeader = "x-hasura-admin-secret" //nolint:gosec
)

var (
	errGraphqlRequest  = errors.New("graphql request failed")
	errGraphqlResponse = errors.New("graphql response contains errors")
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "storage",
		Aliases: []string{},
		Usage:   "Manage storage",
		Commands: []*cli.Command{
			CommandSeed(),
		},
	}
}

// commonFlags returns the flags shared by every storage subcommand.
func commonFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name: flagSubdomain,
			Usage: "Project subdomain. Use 'local' for the local development " +
				"environment. Defaults to the linked project.",
			Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagAdminSecret,
			Usage:    "Hasura admin secret",
			Sources:  cli.EnvVars("NHOST_ADMIN_SECRET"),
			Required: true,
		},
		&cli.UintFlag{ //nolint:exhaustruct
			Name:    flagHTTPPort,
			Usage:   "HTTP(S) port for the local development environment",
			Value:   httpsPort,
			Sources: cli.EnvVars("NHOST_HTTP_PORT"),
		},
		&cli.BoolFlag{ //nolint:exhaustruct
			Name:    flagDisableTLS,
			Usage:   "Disable TLS when targeting the local development environment",
			Value:   false,
			Sources: cli.EnvVars("NHOST_DISABLE_TLS"),
		},
	}
}

type endpoints struct {
	storage     string
	graphql     string
	adminSecret string
}

func resolveEndpoints(
	ctx context.Context,
	ce *clienv.CliEnv,
	cmd *cli.Command,
) (*endpoints, error) {
	subdomain := cmd.String(flagSubdomain)
	adminSecret := cmd.String(flagAdminSecret)

	if subdomain == "local" {
		useTLS := !cmd.Bool(flagDisableTLS)
		port := cmd.Uint(flagHTTPPort)
		local := ce.LocalSubdomain()

		return &endpoints{
			storage:     dockercompose.URL(local, "storage", port, useTLS) + "/v1",
			graphql:     dockercompose.URL(local, "graphql", port, useTLS) + "/v1",
			adminSecret: adminSecret,
		}, nil
	}

	proj, err := ce.GetAppInfo(ctx, subdomain)
	if err != nil {
		return nil, fmt.Errorf("failed to get app info: %w", err)
	}

	region := proj.GetRegion().GetName()

	return &endpoints{
		storage: fmt.Sprintf(
			"https://%s.storage.%s.nhost.run/v1", proj.GetSubdomain(), region,
		),
		graphql: fmt.Sprintf(
			"https://%s.graphql.%s.nhost.run/v1", proj.GetSubdomain(), region,
		),
		adminSecret: adminSecret,
	}, nil
}

type fileSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listFilesResponse struct {
	Data struct {
		Files []fileSummary `json:"files"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors,omitempty"`
}

// listFiles returns every uploaded file row in the bucket. Rows where
// isUploaded is false are filtered out at the GraphQL layer.
func listFiles(
	ctx context.Context,
	graphqlURL, adminSecret, bucketID string,
) ([]fileSummary, error) {
	const query = `query StorageListFiles($bucketID: String!) {
  files(where: {bucketId: {_eq: $bucketID}, isUploaded: {_eq: true}}) {
    id
    name
  }
}`

	body, err := json.Marshal(map[string]any{
		"query":     query,
		"variables": map[string]any{"bucketID": bucketID},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal graphql request: %w", err)
	}

	resp, err := postGraphql(ctx, graphqlURL, adminSecret, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return parseListFilesResponse(resp)
}

func postGraphql(
	ctx context.Context,
	graphqlURL, adminSecret string,
	body []byte,
) (*http.Response, error) {
	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, graphqlURL, bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create graphql request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(adminSecretHeader, adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query graphql endpoint: %w", err)
	}

	return resp, nil
}

func parseListFilesResponse(resp *http.Response) ([]fileSummary, error) {
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)

		return nil, fmt.Errorf("%w: status %d: %s", errGraphqlRequest, resp.StatusCode, b)
	}

	var parsed listFilesResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("failed to decode graphql response: %w", err)
	}

	if len(parsed.Errors) > 0 {
		messages := make([]string, len(parsed.Errors))
		for i, e := range parsed.Errors {
			messages[i] = e.Message
		}

		return nil, fmt.Errorf("%w: %v", errGraphqlResponse, messages)
	}

	return parsed.Data.Files, nil
}
