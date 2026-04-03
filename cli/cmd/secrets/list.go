package secrets

import (
	"context"
	"fmt"
	"os"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List secrets in the cloud environment",
		Action:  commandList,
		Flags:   commonFlags(),
	}
}

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	secrets, err := cl.GetSecrets(
		ctx,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get secrets: %w", err)
	}

	appSecrets := secrets.GetAppSecrets()
	isTTY := term.IsTerminal(int(os.Stdout.Fd()))

	if isTTY {
		printSecretsStyled(ce, appSecrets)

		return nil
	}

	for _, secret := range appSecrets {
		ce.Println("%s", secret.Name)
	}

	return nil
}

func printSecretsStyled(
	ce *clienv.CliEnv,
	secrets []*graphql.GetSecrets_AppSecrets,
) {
	dimStyle := lipgloss.NewStyle().Foreground(clienv.ANSIColorDim)
	bullet := lipgloss.NewStyle().Foreground(clienv.ANSIColorGreen).Render("●")

	ce.Println("%s", dimStyle.Render(fmt.Sprintf("Secrets (%d)", len(secrets))))

	for _, secret := range secrets {
		ce.Println("  %s %s", bullet, secret.Name)
	}
}
