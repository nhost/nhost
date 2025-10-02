package clienv

import (
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/nhost/nhost/cli/nhostclient"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
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
	branch         string
	nhclient       *nhostclient.Client
	nhpublicclient *nhostclient.Client
	projectName    string
	localSubdomain string
}

func New(
	stdout io.Writer,
	stderr io.Writer,
	path *PathStructure,
	authURL string,
	graphqlURL string,
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

func (ce *CliEnv) Branch() string {
	return ce.branch
}

func (ce *CliEnv) GetNhostClient(ctx context.Context) (*nhostclient.Client, error) {
	if ce.nhclient == nil {
		session, err := ce.LoadSession(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to load session: %w", err)
		}

		ce.nhclient = nhostclient.New(
			ce.authURL,
			ce.graphqlURL,
			graphql.WithAccessToken(session.Session.AccessToken),
		)
	}

	return ce.nhclient, nil
}

func (ce *CliEnv) GetNhostPublicClient() (*nhostclient.Client, error) {
	if ce.nhpublicclient == nil {
		ce.nhpublicclient = nhostclient.New(ce.authURL, ce.graphqlURL)
	}

	return ce.nhpublicclient, nil
}
