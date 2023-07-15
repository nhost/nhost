package clienv

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nhost/cli/nhostclient/credentials"
)

func savePAT(
	ce *CliEnv,
	session credentials.Credentials,
) error {
	dir := filepath.Dir(ce.Path.AuthFile())
	if !PathExists(dir) {
		if err := os.MkdirAll(dir, 0o755); err != nil { //nolint:gomnd
			return fmt.Errorf("failed to create dir: %w", err)
		}
	}

	if err := MarshalFile(session, ce.Path.AuthFile(), json.Marshal); err != nil {
		return fmt.Errorf("failed to write PAT to file: %w", err)
	}

	return nil
}

func (ce *CliEnv) Login(
	ctx context.Context,
	email string,
	password string,
	pat string,
) (credentials.Credentials, error) {
	cl := ce.GetNhostClient()

	if pat != "" {
		session := credentials.Credentials{
			PersonalAccessToken: pat,
		}
		if err := savePAT(ce, session); err != nil {
			return credentials.Credentials{}, err
		}
		return session, nil
	}

	var err error
	if email == "" {
		ce.PromptMessage("email: ")
		email, err = ce.PromptInput(false)
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read email: %w", err)
		}
	}

	if password == "" {
		ce.PromptMessage("password: ")
		password, err = ce.PromptInput(true)
		ce.Println("")
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read password: %w", err)
		}
	}

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

	if err := savePAT(ce, session); err != nil {
		return credentials.Credentials{}, err
	}

	return session, nil
}
