package clienv

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/cli/nhostclient/credentials"
)

func (ce *CliEnv) LoadSession(
	ctx context.Context,
) (credentials.Session, error) {
	var creds credentials.Credentials
	if err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal); err != nil {
		ce.Warnln("Failed to load valid credentials: %v", err)
		ce.Infoln("Please run `nhost login` and try again.")
		return credentials.Session{}, err
	}

	cl := ce.GetNhostClient()
	session, err := cl.LoginPAT(ctx, creds.PersonalAccessToken)
	if err != nil {
		return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
	}

	return session, nil
}
