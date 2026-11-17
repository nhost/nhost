package deployments

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
)

const (
	flagRef           = "ref"
	flagMessage       = "message"
	flagUser          = "user"
	flagUserAvatarURL = "user-avatar-url"
)

func CommandNew() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "new",
		Aliases:   []string{},
		Usage:     "[EXPERIMENTAL] Create a new deployment",
		ArgsUsage: "<git_ref>",
		Action:    commandNew,
		Flags: append(
			commonFlags(),
			[]cli.Flag{
				&cli.BoolFlag{ //nolint:exhaustruct
					Name:  flagFollow,
					Usage: "Specify if the logs should be streamed. If set, the command will wait for the deployment to finish and stream the logs. If the deployment fails the command will return an error.", //nolint:lll
					Value: false,
				},
				&cli.DurationFlag{ //nolint:exhaustruct
					Name:  flagTimeout,
					Usage: "Specify the timeout for streaming logs",
					Value: time.Minute * 5, //nolint:mnd
				},
				&cli.StringFlag{ //nolint:exhaustruct
					Name:     flagRef,
					Usage:    "Git reference",
					Sources:  cli.EnvVars("GITHUB_SHA"),
					Required: true,
				},
				&cli.StringFlag{ //nolint:exhaustruct
					Name:     flagMessage,
					Usage:    "Commit message",
					Required: true,
				},
				&cli.StringFlag{ //nolint:exhaustruct
					Name:     flagUser,
					Usage:    "Commit user name",
					Sources:  cli.EnvVars("GITHUB_ACTOR"),
					Required: true,
				},
				&cli.StringFlag{ //nolint:exhaustruct
					Name:  flagUserAvatarURL,
					Usage: "Commit user avatar URL",
				},
				&cli.BoolFlag{ //nolint:exhaustruct
					Name:  flagJSON,
					Usage: "Output as JSON. Progress and logs go to stderr",
				},
			}...,
		),
	}
}

func commandNew(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)
	jsonOutput := cmd.Bool(flagJSON)

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain), !jsonOutput)
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	resp, err := cl.InsertPipelineRun(
		ctx,
		graphql.PipelineRunsInsertInput{ //nolint:exhaustruct
			Input: map[string]any{
				"name":                   "nhost-backend-build",
				"app_id":                 proj.ID,
				"commit_sha":             cmd.String(flagRef),
				"commit_user_name":       cmd.String(flagUser),
				"commit_user_avatar_url": cmd.String(flagUserAvatarURL),
				"commit_message":         cmd.String(flagMessage),
			},
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create deployment: %w", err)
	}

	if resp.InsertPipelineRun == nil {
		return errors.New( //nolint:err113
			"failed to create deployment: server returned no pipeline run",
		)
	}

	run := resp.InsertPipelineRun

	// With --json, stdout carries only the JSON result.
	out := ce
	if jsonOutput {
		out = ce.WithStdout(os.Stderr)
	}

	out.Println("Deployment created: %s", run.ID)

	status := string(run.Status)

	var followErr error
	if cmd.Bool(flagFollow) {
		status, followErr = followDeployment(
			ctx, out, cl, proj.ID, run.ID, cmd.Duration(flagTimeout),
		)
	}

	if jsonOutput {
		if err := printNewDeploymentJSON(os.Stdout, run.ID, status); err != nil {
			return err
		}
	}

	return followErr
}

// followDeployment streams the deployment's logs until it finishes and returns
// its final status. It fails if the deployment doesn't succeed, or with an
// empty status if the logs can't be followed until the end.
func followDeployment(
	ctx context.Context,
	ce *clienv.CliEnv,
	cl *graphql.Client,
	appID string,
	pipelineRunID string,
	timeout time.Duration,
) (string, error) {
	ce.Println("")

	ctxWithTimeout, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	now := time.Now()

	status, err := showPipelineRunLogsFollow(
		ctxWithTimeout, ce, cl, appID, pipelineRunID, &now,
	)
	if err != nil {
		if ctxWithTimeout.Err() != nil {
			ce.Println(
				"Timed out waiting for deployment. It may still be running. " +
					"Check status with: nhost deployments list",
			)
		}

		return "", fmt.Errorf("error streaming logs: %w", err)
	}

	if status != string(graphql.PipelineRunStatusEnumSucceeded) {
		return status, fmt.Errorf("deployment failed: %s", status) //nolint:err113
	}

	return status, nil
}

type newDeploymentJSON struct {
	ID     string `json:"id"`
	Status string `json:"status,omitempty"`
}

func printNewDeploymentJSON(w io.Writer, id, status string) error {
	if err := json.NewEncoder(w).Encode(newDeploymentJSON{
		ID:     id,
		Status: status,
	}); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
}
