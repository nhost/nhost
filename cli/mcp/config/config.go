package config

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/mcp/nhost/auth"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const (
	DefaultLocalConfigServerURL = "https://local.dashboard.local.nhost.run/v1/configserver/graphql"
	DefaultLocalGraphqlURL      = "https://local.graphql.local.nhost.run/v1"
)

var ErrProjectNotConfigured = errors.New("project not configured")

type Config struct {
	// If configured allows managing the cloud. For instance, this allows you to configure
	// projects, list projects, organizations, and so on.
	Cloud *Cloud `json:"cloud,omitempty" toml:"cloud"`

	// Projects is a list of projects that you want to allow access to. This grants access
	// to the GraphQL schema allowing it to inspect it and run allowed queries and mutations.
	Projects ProjectList `json:"projects" toml:"projects"`
}

type Cloud struct {
	// If enabled you can run mutations against the Nhost Cloud to manipulate project's configurations
	// amongst other things. Queries are always allowed if this section is configured.
	EnableMutations bool `json:"enable_mutations" toml:"enable_mutations"`
}

type ProjectList []Project

func (pl ProjectList) Get(subdomain string) (*Project, error) {
	for _, p := range pl {
		if p.Subdomain == subdomain {
			return &p, nil
		}
	}

	return nil, fmt.Errorf("%w: %s", ErrProjectNotConfigured, subdomain)
}

func (pl ProjectList) Subdomains() []string {
	subdomains := make([]string, 0, len(pl))

	for _, p := range pl {
		subdomains = append(subdomains, p.Subdomain)
	}

	return subdomains
}

func (pl ProjectList) Instructions() string {
	if len(pl) == 0 {
		return "No projects configured. Please, run `nhost mcp config` to configure your projects."
	}

	var sb strings.Builder
	sb.WriteString("Configured projects:\n")

	for _, p := range pl {
		sb.WriteString(fmt.Sprintf("- %s (%s): %s\n", p.Subdomain, p.Region, p.Description))
	}

	return sb.String()
}

type Project struct {
	// Project's subdomain
	Subdomain string `json:"subdomain" toml:"subdomain"`

	// Project's region
	Region string `json:"region" toml:"region"`

	// Project's description
	Description string `json:"description,omitempty" toml:"description,omitempty"`

	// Admin secret to operate against the project.
	// Either admin secret or PAT is required.
	AdminSecret *string `json:"admin_secret,omitempty" toml:"admin_secret,omitempty"`

	// PAT to operate against the project. Note this PAT must belong to this project.
	// Either admin secret or PAT is required.
	PAT *string `json:"pat,omitempty" toml:"pat,omitempty"`

	// If enabled, allows managing the project's metadata (tables, relationships,
	// permissions, etc).
	ManageMetadata bool `json:"manage_metadata,omitempty" toml:"manage_metadata,omitempty"`

	// List of queries that are allowed to be executed against the project.
	// If empty, no queries are allowed. Use [*] to allow all queries.
	AllowQueries []string `json:"allow_queries" toml:"allow_queries"`

	// List of mutations that are allowed to be executed against the project.
	// If empty, no mutations are allowed. Use [*] to allow all mutations.
	// Note that this is only used if the project is configured to allow mutations.
	AllowMutations []string `json:"allow_mutations" toml:"allow_mutations"`

	// GraphQL URL to use when running against the project. Defaults to constructed URL with
	// the subdomain and region.
	GraphqlURL string `json:"graphql_url,omitzero" toml:"graphql_url,omitzero"`

	// Auth URL to use when running against the project. Defaults to constructed URL with
	// the subdomain and region.
	AuthURL string `json:"auth_url,omitzero" toml:"auth_url,omitzero"`

	// Hasura's base URL. Defaults to constructed URL with the subdomain and region.
	HasuraURL string `json:"hasura_url,omitzero" toml:"hasura_url,omitzero"`
}

func (p *Project) GetAuthURL() string {
	if p.AuthURL != "" {
		return p.AuthURL
	}

	return fmt.Sprintf("https://%s.auth.%s.nhost.run/v1", p.Subdomain, p.Region)
}

func (p *Project) GetGraphqlURL() string {
	if p.GraphqlURL != "" {
		return p.GraphqlURL
	}

	return fmt.Sprintf("https://%s.graphql.%s.nhost.run/v1", p.Subdomain, p.Region)
}

func (p *Project) GetHasuraURL() string {
	if p.HasuraURL != "" {
		return p.HasuraURL
	}

	return fmt.Sprintf("https://%s.hasura.%s.nhost.run", p.Subdomain, p.Region)
}

func (p *Project) GetAuthInterceptor() (func(ctx context.Context, req *http.Request) error, error) {
	if p.AdminSecret != nil {
		return auth.WithAdminSecret(*p.AdminSecret), nil
	} else if p.PAT != nil {
		interceptor, err := auth.WithPAT(p.GetAuthURL(), *p.PAT)
		if err != nil {
			return nil, fmt.Errorf("failed to create PAT interceptor: %w", err)
		}

		return interceptor, nil
	}

	return func(_ context.Context, _ *http.Request) error {
		return nil
	}, nil
}

func GetConfigPath(cmd *cli.Command) string {
	configPath := cmd.String("config-file")
	if configPath != "" {
		return configPath
	}

	ce := clienv.FromCLI(cmd)

	return filepath.Join(ce.Path.DotNhostFolder(), "mcp-nhost.toml")
}

func Load(path string) (*Config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	interpolated := interpolateEnv(string(content), os.Getenv)

	decoder := toml.NewDecoder(strings.NewReader(interpolated))
	decoder.DisallowUnknownFields()

	var config Config
	if err := decoder.Decode(&config); err != nil {
		var (
			decodeErr *toml.DecodeError
			strictErr *toml.StrictMissingError
		)

		if errors.As(err, &decodeErr) {
			return nil, errors.New("\n" + decodeErr.String()) //nolint:err113
		} else if errors.As(err, &strictErr) {
			return nil, errors.New("\n" + strictErr.String()) //nolint:err113
		}

		return nil, fmt.Errorf("failed to unmarshal config file: %w", err)
	}

	return &config, nil
}
