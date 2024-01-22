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
	stdout      io.Writer
	stderr      io.Writer
	Path        *PathStructure
	domain      string
	branch      string
	nhclient    *nhostclient.Client
	projectName string
}

func New(
	stdout io.Writer,
	stderr io.Writer,
	path *PathStructure,
	domain string,
	branch string,
	projectName string,
) *CliEnv {
	return &CliEnv{
		stdout:      stdout,
		stderr:      stderr,
		Path:        path,
		domain:      domain,
		branch:      branch,
		nhclient:    nil,
		projectName: projectName,
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
			cCtx.String(flagDataFolder),
			cCtx.String(flagNhostFolder),
		),
		domain:      cCtx.String(flagDomain),
		branch:      cCtx.String(flagBranch),
		projectName: sanitizeName(cCtx.String(flagProjectName)),
		nhclient:    nil,
	}
}

func (ce *CliEnv) ProjectName() string {
	return ce.projectName
}

func (ce *CliEnv) Domain() string {
	return ce.domain
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
			ce.domain,
			graphql.WithAccessToken(session.Session.AccessToken),
		)
	}
	return ce.nhclient, nil
}
