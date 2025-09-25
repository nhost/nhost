package deployments

import (
	"context"
	"fmt"
	"time"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
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
					EnvVars:  []string{"GITHUB_SHA"},
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
					EnvVars:  []string{"GITHUB_ACTOR"},
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

func ptr[i any](v i) *i {
	return &v
}

func commandNew(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	resp, err := cl.InsertDeployment(
		cCtx.Context,
		graphql.DeploymentsInsertInput{
			App:                 nil,
			AppID:               ptr(proj.ID),
			CommitMessage:       ptr(cCtx.String(flagMessage)),
			CommitSha:           ptr(cCtx.String(flagRef)),
			CommitUserAvatarURL: ptr(cCtx.String(flagUserAvatarURL)),
			CommitUserName:      ptr(cCtx.String(flagUser)),
			DeploymentStatus:    ptr("SCHEDULED"),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to insert deployment: %w", err)
	}

	ce.Println("Deployment created: %s", resp.InsertDeployment.ID)

	if cCtx.Bool(flagFollow) {
		ce.Println("")

		ctx, cancel := context.WithTimeout(cCtx.Context, cCtx.Duration(flagTimeout))
		defer cancel()

		status, err := showLogsFollow(ctx, ce, cl, resp.InsertDeployment.ID)
		if err != nil {
			return fmt.Errorf("error streaming logs: %w", err)
		}

		if status != "DEPLOYED" {
			return fmt.Errorf("deployment failed: %s", status) //nolint:err113
		}
	}

	return nil
}
