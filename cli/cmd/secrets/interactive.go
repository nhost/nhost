package secrets

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/nhost/nhost/cli/tui"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

func isTTY() bool {
	return term.IsTerminal(int(os.Stdout.Fd()))
}

func resolveNameValue(cmd *cli.Command) (string, string, error) {
	switch cmd.NArg() {
	case 2: //nolint:mnd
		return cmd.Args().Get(0), cmd.Args().Get(1), nil
	case 1:
		val, err := promptSecretValue(cmd.Args().Get(0))

		return cmd.Args().Get(0), val, err
	case 0:
		if !isTTY() {
			return "", "", errors.New( //nolint:err113
				"expected at least 1 argument: NAME [VALUE]",
			)
		}

		return promptNameAndValue()
	default:
		return "", "", errors.New( //nolint:err113
			"expected at most 2 arguments: NAME [VALUE]",
		)
	}
}

func promptNameAndValue() (string, string, error) {
	name, err := tui.RunPrompt("Secret name", "")
	if err != nil || name == "" {
		return "", "", errors.New("secret name is required") //nolint:err113
	}

	val, err := promptSecretValue(name)

	return name, val, err
}

func promptSecretValue(name string) (string, error) {
	if !isTTY() {
		return "", errors.New( //nolint:err113
			"VALUE argument is required in non-interactive mode",
		)
	}

	value, err := tui.RunPrompt("Value for "+name, "")
	if err != nil || value == "" {
		return "", errors.New("secret value is required") //nolint:err113
	}

	return value, nil
}

func resolveDeleteName(
	ctx context.Context,
	cmd *cli.Command,
	ce *clienv.CliEnv,
	appID string,
) (string, error) {
	if cmd.NArg() == 1 {
		return cmd.Args().Get(0), nil
	}

	if cmd.NArg() > 1 {
		return "", errors.New("expected at most 1 argument: NAME") //nolint:err113
	}

	if !isTTY() {
		return "", errors.New("expected 1 argument: NAME") //nolint:err113
	}

	return pickSecret(ctx, ce, appID)
}

func pickSecret(
	ctx context.Context,
	ce *clienv.CliEnv,
	appID string,
) (string, error) {
	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get nhost client: %w", err)
	}

	resp, err := cl.GetSecrets(ctx, appID)
	if err != nil {
		return "", fmt.Errorf("failed to get secrets: %w", err)
	}

	return pickFromSecretList(resp.GetAppSecrets())
}

func pickFromSecretList(
	secrets []*graphql.GetSecrets_AppSecrets,
) (string, error) {
	if len(secrets) == 0 {
		return "", errors.New("no secrets found") //nolint:err113
	}

	items := make([]tui.PickerItem, len(secrets))
	for i, s := range secrets {
		items[i] = tui.PickerItem{
			Label:    s.Name,
			Desc:     "",
			Value:    nil,
			Selected: false,
		}
	}

	idx, err := tui.RunPicker("Select secret", items)
	if err != nil {
		return "", nil //nolint:nilerr
	}

	return secrets[idx].Name, nil
}
