package clienv

import (
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/Yamashou/gqlgenc/clientv2"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/internal/lib/nhostclient"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

func sanitizeName(name string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	return strings.ToLower(re.ReplaceAllString(name, ""))
}

type CliEnv struct {
	stdout         io.Writer
	stderr         io.Writer
	Path           *PathStructure
	authURL        string
	graphqlURL     string
	oauth2ClientID string
	pat            string
	branch         string
	nhclient       *graphql.Client
	nhpublicclient *graphql.Client
	projectName    string
	localSubdomain string
}

func New(
	stdout io.Writer,
	stderr io.Writer,
	path *PathStructure,
	authURL string,
	graphqlURL string,
	oauth2ClientID string,
	pat string,
	branch string,
	projectName string,
	localSubdomain string,
) *CliEnv {
	return &CliEnv{
		stdout:         stdout,
		stderr:         stderr,
		Path:           path,
		authURL:        authURL,
		graphqlURL:     graphqlURL,
		oauth2ClientID: oauth2ClientID,
		pat:            pat,
		branch:         branch,
		nhclient:       nil,
		nhpublicclient: nil,
		projectName:    projectName,
		localSubdomain: localSubdomain,
	}
}

func FromCLI(cmd *cli.Command) *CliEnv {
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	return &CliEnv{
		stdout: cmd.Writer,
		stderr: cmd.ErrWriter,
		Path: NewPathStructure(
			cwd,
			cmd.String(flagRootFolder),
			cmd.String(flagDotNhostFolder),
			cmd.String(flagNhostFolder),
		),
		authURL:        cmd.String(flagAuthURL),
		graphqlURL:     cmd.String(flagGraphqlURL),
		oauth2ClientID: cmd.String(flagOAuth2ClientID),
		pat:            cmd.String(flagPAT),
		branch:         cmd.String(flagBranch),
		projectName:    sanitizeName(cmd.String(flagProjectName)),
		nhclient:       nil,
		nhpublicclient: nil,
		localSubdomain: cmd.String(flagLocalSubdomain),
	}
}

func (ce *CliEnv) ProjectName() string {
	return ce.projectName
}

func (ce *CliEnv) LocalSubdomain() string {
	return ce.localSubdomain
}

func (ce *CliEnv) AuthURL() string {
	return ce.authURL
}

func (ce *CliEnv) GraphqlURL() string {
	return ce.graphqlURL
}

func (ce *CliEnv) OAuth2ClientID() string {
	return ce.oauth2ClientID
}

func (ce *CliEnv) PAT() string {
	return ce.pat
}

func (ce *CliEnv) Branch() string {
	return ce.branch
}

func (ce *CliEnv) NewAuthClient() (*auth.ClientWithResponses, error) {
	return auth.NewClientWithResponses(
		ce.authURL,
		auth.WithHTTPClient(nhostclient.NewRetryDoer(nil)),
	)
}

func (ce *CliEnv) GetNhostClient(ctx context.Context) (*graphql.Client, error) {
	if ce.nhclient == nil {
		accessToken, err := ce.LoadSession(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to load session: %w", err)
		}

		ce.nhclient = graphql.NewClient(
			nhostclient.NewRetryDoer(nil),
			ce.graphqlURL,
			&clientv2.Options{}, //nolint:exhaustruct
			graphql.WithAccessToken(accessToken),
		)
	}

	return ce.nhclient, nil
}

func (ce *CliEnv) GetNhostPublicClient() (*graphql.Client, error) {
	if ce.nhpublicclient == nil {
		ce.nhpublicclient = graphql.NewClient(
			nhostclient.NewRetryDoer(nil),
			ce.graphqlURL,
			&clientv2.Options{}, //nolint:exhaustruct
		)
	}

	return ce.nhpublicclient, nil
}
