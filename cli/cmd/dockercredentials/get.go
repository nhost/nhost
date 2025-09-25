package dockercredentials

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/nhost/cli/clienv"
	"github.com/urfave/cli/v2"
)

const (
	flagAuthURL    = "auth-url"
	flagGraphqlURL = "graphql-url"
)

func CommandGet() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "get",
		Aliases: []string{},
		Usage:   "Get credentials for the logged in user",
		Hidden:  true,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagAuthURL,
				Usage:   "Nhost auth URL",
				EnvVars: []string{"NHOST_CLI_AUTH_URL"},
				Value:   "https://otsispdzcwxyqzbfntmj.auth.eu-central-1.nhost.run/v1",
				Hidden:  true,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:    flagGraphqlURL,
				Usage:   "Nhost GraphQL URL",
				EnvVars: []string{"NHOST_CLI_GRAPHQL_URL"},
				Value:   "https://otsispdzcwxyqzbfntmj.graphql.eu-central-1.nhost.run/v1",
				Hidden:  true,
			},
		},
		Action: actionGet,
	}
}

func getToken(ctx context.Context, authURL, graphqlURL string) (string, error) {
	ce := clienv.New(
		os.Stdout,
		os.Stderr,
		&clienv.PathStructure{},
		authURL,
		graphqlURL,
		"unneeded",
		"unneeded",
		"unneeded",
	)

	session, err := ce.LoadSession(ctx)
	if err != nil {
		return "", err //nolint:wrapcheck
	}

	return session.Session.AccessToken, nil
}

//nolint:tagliatelle
type response struct {
	ServerURL string `json:"ServerURL"`
	Username  string `json:"Username"`
	Secret    string `json:"Secret"`
}

func actionGet(c *cli.Context) error {
	scanner := bufio.NewScanner(c.App.Reader)

	var input string
	for scanner.Scan() {
		input += scanner.Text()
	}

	token, err := getToken(c.Context, c.String(flagAuthURL), c.String(flagGraphqlURL))
	if err != nil {
		return err
	}

	b, err := json.Marshal(response{
		ServerURL: input,
		Username:  "nhost",
		Secret:    token,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	if _, err = c.App.Writer.Write(b); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}

	return nil
}
