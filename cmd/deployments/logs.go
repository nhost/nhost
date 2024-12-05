package deployments

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient"
	"github.com/urfave/cli/v2"
)

const (
	flagFollow  = "follow"
	flagTimeout = "timeout"
)

func CommandLogs() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "logs",
		Aliases:   []string{},
		Usage:     "View deployments logs in the cloud environment",
		Action:    commandLogs,
		ArgsUsage: "<deployment_id>",
		Flags: append(
			commonFlags(),
			[]cli.Flag{
				&cli.BoolFlag{ //nolint:exhaustruct
					Name:  flagFollow,
					Usage: "Specify if the logs should be streamed",
					Value: false,
				},
				&cli.DurationFlag{ //nolint:exhaustruct
					Name:  flagTimeout,
					Usage: "Specify the timeout for streaming logs",
					Value: time.Minute * 5, //nolint:mnd
				},
			}...,
		),
	}
}

func showLogsSimple(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *nhostclient.Client,
	deploymentID string,
) error {
	resp, err := cl.GetDeploymentLogs(ctx, deploymentID)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}

	for _, log := range resp.GetDeploymentLogs() {
		ce.Println(
			"%s %s",
			log.GetCreatedAt().Format(time.RFC3339),
			log.GetMessage(),
		)
	}

	return nil
}

func showLogsFollow(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *nhostclient.Client,
	deploymentID string,
) (string, error) {
	ticker := time.NewTicker(time.Second * 2) //nolint:mnd

	printed := make(map[string]struct{})

	for {
		select {
		case <-ctx.Done():
			return "", nil
		case <-ticker.C:
			resp, err := cl.GetDeploymentLogs(ctx, deploymentID)
			if err != nil {
				return "", fmt.Errorf("failed to get deployments: %w", err)
			}

			for _, log := range resp.GetDeploymentLogs() {
				if _, ok := printed[log.GetID()]; !ok {
					ce.Println(
						"%s %s",
						log.GetCreatedAt().Format(time.RFC3339),
						log.GetMessage(),
					)
					printed[log.GetID()] = struct{}{}
				}
			}

			if resp.Deployment.DeploymentEndedAt != nil {
				return *resp.Deployment.DeploymentStatus, nil
			}
		}
	}
}

func commandLogs(cCtx *cli.Context) error {
	deploymentID := cCtx.Args().First()
	if deploymentID == "" {
		return errors.New("deployment_id is required") //nolint:goerr113
	}

	ce := clienv.FromCLI(cCtx)

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	if cCtx.Bool(flagFollow) {
		ctx, cancel := context.WithTimeout(cCtx.Context, cCtx.Duration(flagTimeout))
		defer cancel()

		if _, err := showLogsFollow(ctx, ce, cl, deploymentID); err != nil {
			return err
		}
	} else {
		if err := showLogsSimple(cCtx.Context, ce, cl, deploymentID); err != nil {
			return err
		}
	}

	return nil
}
