package deployments

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
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
	cl *graphql.Client,
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
	cl *graphql.Client,
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

func showPipelineRunLogsSimple(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *graphql.Client,
	appID string,
	pipelineRunID string,
	from *time.Time,
) error {
	resp, err := cl.GetPipelineRunLogs(ctx, appID, pipelineRunID, from, nil)
	if err != nil {
		return fmt.Errorf("failed to get pipeline run logs: %w", err)
	}

	for _, log := range resp.GetGetPipelineRunLogs() {
		ce.Println(
			"%s [%s] %s",
			log.Timestamp.Format(time.RFC3339),
			log.Task,
			log.Log,
		)
	}

	return nil
}

func printNewPipelineRunLogs(
	ce *clienv.CliEnv,
	logs []*graphql.GetPipelineRunLogs_GetPipelineRunLogs,
	printed map[string]struct{},
) *time.Time {
	var lastTimestamp *time.Time

	for _, log := range logs {
		key := fmt.Sprintf("%s|%s|%s", log.Timestamp.Format(time.RFC3339Nano), log.Task, log.Log)
		if _, ok := printed[key]; ok {
			continue
		}

		ce.Println(
			"%s [%s] %s",
			log.Timestamp.Format(time.RFC3339),
			log.Task,
			log.Log,
		)

		printed[key] = struct{}{}

		if lastTimestamp == nil || log.Timestamp.After(*lastTimestamp) {
			ts := log.Timestamp
			lastTimestamp = &ts
		}
	}

	return lastTimestamp
}

func showPipelineRunLogsFollow(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *graphql.Client,
	appID string,
	pipelineRunID string,
	from *time.Time,
) (string, error) {
	ticker := time.NewTicker(time.Second * 2) //nolint:mnd
	printed := make(map[string]struct{})

	for {
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("log following timed out: %w", ctx.Err())
		case <-ticker.C:
			logsResp, err := cl.GetPipelineRunLogs(ctx, appID, pipelineRunID, from, nil)
			if err != nil {
				return "", fmt.Errorf("failed to get pipeline run logs: %w", err)
			}

			if ts := printNewPipelineRunLogs(
				ce,
				logsResp.GetGetPipelineRunLogs(),
				printed,
			); ts != nil {
				from = ts
			}

			statusResp, err := cl.GetPipelineRun(ctx, pipelineRunID)
			if err != nil {
				return "", fmt.Errorf("failed to get pipeline run status: %w", err)
			}

			if statusResp.PipelineRun != nil && statusResp.PipelineRun.EndedAt != nil {
				return string(statusResp.PipelineRun.Status), nil
			}
		}
	}
}

func handleLegacyLogs(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *graphql.Client,
	deploymentID string,
	follow bool,
	timeout time.Duration,
) error {
	if follow {
		ctxWithTimeout, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		if _, err := showLogsFollow(ctxWithTimeout, ce, cl, deploymentID); err != nil {
			return err
		}

		return nil
	}

	return showLogsSimple(ctx, ce, cl, deploymentID)
}

func handlePipelineRunLogs(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *graphql.Client,
	appID string,
	deploymentID string,
	from *time.Time,
	follow bool,
	timeout time.Duration,
) error {
	if follow {
		ctxWithTimeout, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		if _, err := showPipelineRunLogsFollow(
			ctxWithTimeout,
			ce,
			cl,
			appID,
			deploymentID,
			from,
		); err != nil {
			return err
		}

		return nil
	}

	return showPipelineRunLogsSimple(ctx, ce, cl, appID, deploymentID, from)
}

func commandLogs(ctx context.Context, cmd *cli.Command) error {
	deploymentID := cmd.Args().First()
	if deploymentID == "" {
		return errors.New("deployment_id is required") //nolint:err113
	}

	ce := clienv.FromCLI(cmd)

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	follow := cmd.Bool(flagFollow)
	timeout := cmd.Duration(flagTimeout)

	// Try as pipeline run first; fall back to legacy deployment
	pipelineRunResp, pipelineRunErr := cl.GetPipelineRun(ctx, deploymentID)
	if pipelineRunErr != nil {
		return fmt.Errorf("failed to get pipeline run: %w", pipelineRunErr)
	}

	if pipelineRunResp != nil && pipelineRunResp.PipelineRun != nil {
		from := &pipelineRunResp.PipelineRun.CreatedAt

		return handlePipelineRunLogs(
			ctx, ce, cl, proj.ID, deploymentID, from, follow, timeout,
		)
	}

	return handleLegacyLogs(ctx, ce, cl, deploymentID, follow, timeout)
}
