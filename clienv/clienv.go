package clienv

import (
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/nhost/cli/nhostclient"
	"github.com/urfave/cli/v2"
)

func sanitizeName(name string) string {
	re := regexp.MustCompile(`[^a-z0-9_-]`)
	return strings.ToLower(re.ReplaceAllString(name, ""))
}

type CliEnv struct {
	stdout      io.Writer
	stderr      io.Writer
	Path        *PathStructure
	domain      string
	nhclient    *nhostclient.Client
	projectName string
}

func New(
	stdout io.Writer,
	stderr io.Writer,
	path *PathStructure,
	domain string,
	projectName string,
) *CliEnv {
	return &CliEnv{
		stdout:      stdout,
		stderr:      stderr,
		Path:        path,
		domain:      domain,
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

func (ce *CliEnv) GetNhostClient() *nhostclient.Client {
	if ce.nhclient == nil {
		ce.nhclient = nhostclient.New(ce.domain)
	}
	return ce.nhclient
}
