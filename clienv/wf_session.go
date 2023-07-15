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
		creds, err = ce.Login(ctx, "", "", "")
		if err != nil {
			return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
		}
	}

	cl := ce.GetNhostClient()
	session, err := cl.LoginPAT(ctx, creds.PersonalAccessToken)
	if err != nil {
		return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
	}

	return session, nil
}
