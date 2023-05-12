package controller

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/credentials"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func Login(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	email string,
	password string,
) (credentials.Credentials, error) {
	var err error

	if email == "" {
		p.Print(tui.PromptMessage("email: "))
		email, err = tui.PromptInput(false)
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read email: %w", err)
		}
	}

	if password == "" {
		p.Print(tui.PromptMessage("password: "))
		password, err = tui.PromptInput(true)
		p.Println()
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to read password: %w", err)
		}
	}

	p.Println(tui.Info("Authenticating"))
	loginResp, err := cl.Login(ctx, email, password)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to login: %w", err)
	}

	p.Println(tui.Info("Successfully logged in, creating PAT"))
	session, err := cl.CreatePAT(ctx, loginResp.Session.AccessToken)
	if err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to create PAT: %w", err)
	}
	p.Println(tui.Info("Successfully created PAT"))
	p.Println(tui.Info("Storing PAT for future user"))

	if err := MarshalFile(session, system.PathAuthFile(), json.Marshal); err != nil {
		return credentials.Credentials{}, fmt.Errorf("failed to write PAT to file: %w", err)
	}

	return session, nil
}
