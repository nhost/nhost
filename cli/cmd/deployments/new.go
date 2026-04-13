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
			}...,
		),
	}
}

func commandNew(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
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
			"failed to create deployment: server returned no pipeline run")
	}

	ce.Println("Deployment created: %s", resp.InsertPipelineRun.ID)

	if cmd.Bool(flagFollow) {
		ce.Println("")

		ctxWithTimeout, cancel := context.WithTimeout(ctx, cmd.Duration(flagTimeout))
		defer cancel()

		now := time.Now()

		status, err := showPipelineRunLogsFollow(
			ctxWithTimeout, ce, cl, proj.ID, resp.InsertPipelineRun.ID, &now,
		)
		if err != nil {
			if ctxWithTimeout.Err() != nil {
				ce.Println(
					"Timed out waiting for deployment. It may still be running. " +
						"Check status with: nhost deployments list",
				)
			}

			return fmt.Errorf("error streaming logs: %w", err)
		}

		if status != string(graphql.PipelineRunStatusEnumSucceeded) {
			return fmt.Errorf("deployment failed: %s", status) //nolint:err113
		}
	}

	return nil
}
