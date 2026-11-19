package secrets

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
)

const flagSubdomain = "subdomain"

func commonFlags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagSubdomain,
			Usage:   "Project's subdomain to operate on, defaults to linked project",
			Sources: cli.EnvVars("NHOST_SUBDOMAIN"),
		},
	}
}

func jsonFlag() *cli.BoolFlag {
	return &cli.BoolFlag{ //nolint:exhaustruct
		Name:  flagJSON,
		Usage: "Output as JSON",
	}
}

// secretResultJSON is what create, update and delete print with --json.
type secretResultJSON struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

func printSecretResultJSON(w io.Writer, name, status string) error {
	if err := json.NewEncoder(w).Encode(secretResultJSON{
		Name:   name,
		Status: status,
	}); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}

// runSecretMutation resolves the target project, obtains a client and applies
// the given secret mutation (create or update). On success it prints
// "Secret <status> successfully!", or the result as JSON with --json.
func runSecretMutation(
	ctx context.Context,
	cmd *cli.Command,
	status string,
	mutate func(cl *graphql.Client, appID, name, value string) error,
) error {
	jsonOutput := cmd.Bool(flagJSON)
	interactive := isTTY() && !jsonOutput

	name, value, err := resolveNameValue(cmd, interactive)
	if err != nil {
		return err
	}

	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain), interactive)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if err := mutate(cl, proj.ID, name, value); err != nil {
		return err
	}

	if jsonOutput {
		return printSecretResultJSON(os.Stdout, name, status)
	}

	ce.Infoln("Secret %s successfully!", status)

	return nil
}

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "secrets",
		Aliases: []string{},
		Usage:   "Manage secrets",
		Commands: []*cli.Command{
			CommandCreate(),
			CommandDelete(),
			CommandList(),
			CommandUpdate(),
		},
	}
}
