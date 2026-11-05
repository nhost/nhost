package info

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"github.com/urfave/cli/v3"
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:   "info",
		Usage:  "Show the signed-in user and the linked project",
		Action: commandInfo,
	}
}

func commandInfo(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	user, err := getUser(ctx, ce)
	if err != nil {
		return err
	}

	email := "-"
	if user.Email != nil {
		email = string(*user.Email)
	}

	ce.Infoln("User")
	ce.Println("  Name:      %s", user.DisplayName)
	ce.Println("  Email:     %s", email)
	ce.Println("  ID:        %s", user.Id)
	ce.Println("")

	var project graphql.AppSummaryFragment

	err = clienv.UnmarshalFile(ce.Path.ProjectFile(), &project, json.Unmarshal)

	switch {
	case errors.Is(err, os.ErrNotExist):
		ce.Infoln("Project")
		ce.Println("  Not linked, run `nhost link` to link one")
	case err != nil:
		return fmt.Errorf("failed to read linked project: %w", err)
	default:
		ce.Infoln("Project")
		ce.Println("  Name:      %s", project.Name)
		ce.Println("  ID:        %s", project.ID)
		ce.Println("  Subdomain: %s", project.Subdomain)
		ce.Println("  Region:    %s", project.Region.Name)
	}

	return nil
}

func getUser(ctx context.Context, ce *clienv.CliEnv) (*auth.User, error) {
	interceptor, err := ce.NewCloudInterceptor(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to authenticate: %w", err)
	}

	cl, err := ce.NewAuthClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create auth client: %w", err)
	}

	resp, err := cl.GetUserWithResponse(ctx, interceptor)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if resp.JSON200 == nil {
		return nil, fmt.Errorf("failed to get user: %s", resp.Status()) //nolint:err113
	}

	return resp.JSON200, nil
}
