package clienv

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/nhost/cli/nhostclient"
	"github.com/nhost/cli/nhostclient/credentials"
	"github.com/urfave/cli/v2"
)

type CliEnv struct {
	stdout      io.Writer
	stderr      io.Writer
	Path        *PathStructure
	domain      string
	nhclient    *nhostclient.Client
	projectName string
}

func New(cCtx *cli.Context) *CliEnv {
	return &CliEnv{
		stdout: cCtx.App.Writer,
		stderr: cCtx.App.ErrWriter,
		Path: NewPathStructure(
			cCtx.String(flagRootFolder),
			cCtx.String(flagDotNhostFolder),
			cCtx.String(flagDataFolder),
			cCtx.String(flagNhostFolder),
		),
		domain:      cCtx.String(flagDomain),
		projectName: cCtx.String(flagProjectName),
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

func (ce *CliEnv) Login(
	ctx context.Context,
	email string,
	password string,
) (credentials.Credentials, error) {
	cl := ce.GetNhostClient()

	ce.Infoln("Authenticating")
	loginResp, err := cl.Login(ctx, email, password)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to login: %w", err)
	}

	ce.Infoln("Successfully logged in, creating PAT")
	session, err := cl.CreatePAT(ctx, loginResp.Session.AccessToken)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to create PAT: %w", err)
	}
	ce.Infoln("Successfully created PAT")
	ce.Infoln("Storing PAT for future user")

	dir := filepath.Dir(ce.Path.AuthFile())
	if !PathExists(dir) {
		if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:gomnd
			return credentials.Credentials{}, fmt.Errorf("failed to create dir: %w", err)
		}
	}

	if err := MarshalFile(session, ce.Path.AuthFile(), json.Marshal); err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to write PAT to file: %w", err)
	}

	return session, nil
}
