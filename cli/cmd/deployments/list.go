package deployments

import (
	"context"
	"fmt"
	"time"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
)

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List deployments in the cloud environment",
		Action:  commandList,
		Flags:   commonFlags(),
	}
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}

	return *s
}

func printDeployments(
	ce *clienv.CliEnv,
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
) {
	id := clienv.Column{
		Header: "ID",
		Rows:   make([]string, 0),
	}
	date := clienv.Column{
		Header: "Date",
		Rows:   make([]string, 0),
	}
	duration := clienv.Column{
		Header: "Duration",
		Rows:   make([]string, 0),
	}
	status := clienv.Column{
		Header: "Status",
		Rows:   make([]string, 0),
	}
	user := clienv.Column{
		Header: "User",
		Rows:   make([]string, 0),
	}
	ref := clienv.Column{
		Header: "Ref",
		Rows:   make([]string, 0),
	}
	message := clienv.Column{
		Header: "Message",
		Rows:   make([]string, 0),
	}

	for _, d := range deployments {
		var startedAt time.Time
		if d.StartedAt != nil && !d.StartedAt.IsZero() {
			startedAt = *d.StartedAt
		}

		var (
			endedAt      time.Time
			deplDuration time.Duration
		)

		if d.EndedAt != nil && !d.EndedAt.IsZero() {
			endedAt = *d.EndedAt
			deplDuration = endedAt.Sub(startedAt)
		}

		id.Rows = append(id.Rows, derefStr(d.ID))
		date.Rows = append(date.Rows, startedAt.Format(time.RFC3339))
		duration.Rows = append(duration.Rows, deplDuration.String())
		status.Rows = append(status.Rows, derefStr(d.Status))
		user.Rows = append(user.Rows, derefStr(d.CommitUserName))
		ref.Rows = append(ref.Rows, derefStr(d.CommitSha))
		message.Rows = append(message.Rows, derefStr(d.CommitMessage))
	}

	ce.Println("%s", clienv.Table(id, date, duration, status, user, ref, message))
}

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := ce.GetAppInfo(ctx, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	resp, err := cl.ListUnifiedDeployments(
		ctx,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}

	printDeployments(ce, resp.GetUnifiedDeployments())

	return nil
}
