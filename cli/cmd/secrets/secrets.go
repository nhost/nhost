package secrets

import (
	"context"
	"fmt"

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

// runSecretMutation resolves the target project, obtains a client and applies
// the given secret mutation (create or update), printing successMsg on success.
func runSecretMutation(
	ctx context.Context,
	cmd *cli.Command,
	successMsg string,
	mutate func(cl *graphql.Client, appID, name, value string) error,
) error {
	name, value, err := resolveNameValue(cmd)
	if err != nil {
		return err
	}

	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain), true)
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

	ce.Infoln("%s", successMsg)

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
