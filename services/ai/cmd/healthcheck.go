package cmd

import (
	"fmt"
	"io"
	"net/http"

	"github.com/urfave/cli/v2"
)

const (
	flagURL = "url"
)

func CommandHealthCheck() *cli.Command {
	return &cli.Command{ //nolint: exhaustruct
		Name:  "healthcheck",
		Usage: "Do a healthcheck of the application",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint: exhaustruct
				Name:  flagURL,
				Usage: "URL to check",
				Value: "http://localhost:8090",
			},
		},
		Action: actionHealthCheck,
	}
}

func actionHealthCheck(cCtx *cli.Context) error {
	// http get to the url
	req, err := http.NewRequestWithContext(
		cCtx.Context,
		http.MethodGet,
		cCtx.String(flagURL)+"/healthz",
		nil,
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)

		return fmt.Errorf( //nolint: err113
			"healthcheck failed with status %d: %s", resp.StatusCode, string(b),
		)
	}

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read body: %w", err)
	}

	fmt.Println(string(b)) //nolint:forbidigo

	return nil
}
