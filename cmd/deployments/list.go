package deployments

import (
	"fmt"
	"time"

	"github.com/nhost/cli/clienv"
	"github.com/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v2"
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

func printDeployments(ce *clienv.CliEnv, deployments []*graphql.ListDeployments_Deployments) {
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
		if d.DeploymentStartedAt != nil && !d.DeploymentStartedAt.IsZero() {
			startedAt = *d.DeploymentStartedAt
		}

		var endedAt time.Time
		var deplPuration time.Duration
		if d.DeploymentEndedAt != nil && !d.DeploymentEndedAt.IsZero() {
			endedAt = *d.DeploymentEndedAt
			deplPuration = endedAt.Sub(startedAt)
		}

		id.Rows = append(id.Rows, d.ID)
		date.Rows = append(date.Rows, startedAt.Format(time.RFC3339))
		duration.Rows = append(duration.Rows, deplPuration.String())
		status.Rows = append(status.Rows, *d.DeploymentStatus)
		user.Rows = append(user.Rows, *d.CommitUserName)
		ref.Rows = append(ref.Rows, d.CommitSha)
		message.Rows = append(message.Rows, *d.CommitMessage)
	}

	ce.Println("%s", clienv.Table(id, date, duration, status, user, ref, message))
}

func commandList(cCtx *cli.Context) error {
	ce := clienv.FromCLI(cCtx)

	proj, err := ce.GetAppInfo(cCtx.Context, cCtx.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(cCtx.Context)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}
	deployments, err := cl.ListDeployments(
		cCtx.Context,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}

	printDeployments(ce, deployments.GetDeployments())

	return nil
}
