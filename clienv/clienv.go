package clienv

import (
	"context"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/nhost/cli/nhostclient"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
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

func FromCLI(cCtx *cli.Context) *CliEnv {
	cwd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	return &CliEnv{
		stdout: cCtx.App.Writer,
		stderr: cCtx.App.ErrWriter,
		Path: NewPathStructure(
			cwd,
			cCtx.String(flagRootFolder),
			cCtx.String(flagDotNhostFolder),
			cCtx.String(flagNhostFolder),
		),
		authURL:        cCtx.String(flagAuthURL),
		graphqlURL:     cCtx.String(flagGraphqlURL),
		branch:         cCtx.String(flagBranch),
		projectName:    sanitizeName(cCtx.String(flagProjectName)),
		nhclient:       nil,
		nhpublicclient: nil,
		localSubdomain: cCtx.String(flagLocalSubdomain),
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
