package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/credentials"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func Logout(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	fs *system.PathStructure,
) error {
	p.Println(tui.Info("Retrieving credentials from local storage"))
	var creds credentials.Credentials
	err := UnmarshalFile(fs.AuthFile(), &creds, json.Unmarshal)
	switch {
	case errors.Is(err, ErrNoContent):
		p.Println(tui.Info("No credentials found in local storage"))
		return err
	case err != nil:
		return fmt.Errorf("failed to get credentials: %w", err)
	}

	p.Println(tui.Info("Getting an access token"))
	loginResp, err := cl.LoginPAT(
		ctx,
		creds.PersonalAccessToken,
	)
	if err != nil {
		return fmt.Errorf("failed to login: %w", err)
	}

	p.Println(tui.Info("Invalidating PAT"))
	if err := cl.Logout(
		ctx,
		creds.PersonalAccessToken,
		loginResp.Session.AccessToken,
	); err != nil {
		return fmt.Errorf("failed to logout: %w", err)
	}

	return nil
}
