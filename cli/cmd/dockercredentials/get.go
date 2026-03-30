package dockercredentials

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

func CommandGet() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "get",
		Aliases: []string{},
		Usage:   "Get credentials for the logged in user",
		Hidden:  true,
		Action:  actionGet,
	}
}

//nolint:tagliatelle
type response struct {
	ServerURL string `json:"ServerURL"`
	Username  string `json:"Username"`
	Secret    string `json:"Secret"`
}

func actionGet(ctx context.Context, cmd *cli.Command) error {
	scanner := bufio.NewScanner(cmd.Root().Reader)

	var (
		input     string
		inputSb76 strings.Builder
	)

	for scanner.Scan() {
		inputSb76.WriteString(scanner.Text())
	}

	input += inputSb76.String()

	ce := clienv.FromCLI(cmd)

	token, err := ce.LoadSession(ctx)
	if err != nil {
		return fmt.Errorf("failed to load session: %w", err)
	}

	b, err := json.Marshal(response{
		ServerURL: input,
		Username:  "nhost",
		Secret:    token,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	if _, err = cmd.Root().Writer.Write(b); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}

	return nil
}
