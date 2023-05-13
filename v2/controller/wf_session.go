package controller

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/cli/v2/nhostclient/credentials"
	"github.com/nhost/cli/v2/system"
	"github.com/nhost/cli/v2/tui"
)

func LoadSession(
	ctx context.Context,
	p Printer,
	cl NhostClient,
	fs *system.PathStructure,
) (credentials.Session, error) {
	var creds credentials.Credentials
	if err := UnmarshalFile(fs.AuthFile(), &creds, json.Unmarshal); err != nil {
		p.Println(tui.Warn("Failed to load valid credentials: %v", err))
		p.Println(tui.Info("Please login again"))
		creds, err = Login(ctx, p, cl, "", "", fs)
		if err != nil {
			return credentials.Session{}, err
		}
	}

	session, err := cl.LoginPAT(ctx, creds.PersonalAccessToken)
	if err != nil {
		return credentials.Session{}, fmt.Errorf("failed to login: %w", err)
	}

	return session, nil
}
