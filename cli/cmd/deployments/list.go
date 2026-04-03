package deployments

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/cmdutil"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
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

func ptrOr(p *string, fallback string) string {
	if p == nil {
		return fallback
	}

	return *p
}

func statusColor(status string) lipgloss.Color {
	switch strings.ToUpper(status) {
	case "DEPLOYED":
		return clienv.ANSIColorGreen
	case "FAILED":
		return clienv.ANSIColorRed
	default:
		return clienv.ANSIColorYellow
	}
}

func buildDeploymentColumns(
	deployments []*graphql.ListDeployments_Deployments,
) (clienv.Column, clienv.Column, clienv.Column, clienv.Column, clienv.Column, clienv.Column, clienv.Column) {
	id := clienv.Column{
		Header: "ID",
		Rows:   make([]string, 0, len(deployments)),
	}
	date := clienv.Column{
		Header: "Date",
		Rows:   make([]string, 0, len(deployments)),
	}
	duration := clienv.Column{
		Header: "Duration",
		Rows:   make([]string, 0, len(deployments)),
	}
	status := clienv.Column{
		Header: "Status",
		Rows:   make([]string, 0, len(deployments)),
	}
	user := clienv.Column{
		Header: "User",
		Rows:   make([]string, 0, len(deployments)),
	}
	ref := clienv.Column{
		Header: "Ref",
		Rows:   make([]string, 0, len(deployments)),
	}
	message := clienv.Column{
		Header: "Message",
		Rows:   make([]string, 0, len(deployments)),
	}

	for _, d := range deployments {
		var startedAt time.Time
		if d.DeploymentStartedAt != nil && !d.DeploymentStartedAt.IsZero() {
			startedAt = *d.DeploymentStartedAt
		}

		var (
			endedAt      time.Time
			deplDuration time.Duration
		)

		if d.DeploymentEndedAt != nil && !d.DeploymentEndedAt.IsZero() {
			endedAt = *d.DeploymentEndedAt
			deplDuration = endedAt.Sub(startedAt)
		}

		statusStr := ptrOr(d.DeploymentStatus, "UNKNOWN")
		id.Rows = append(id.Rows, d.ID)
		date.Rows = append(date.Rows, startedAt.Format(time.RFC3339))
		duration.Rows = append(duration.Rows, deplDuration.String())
		status.Rows = append(status.Rows, statusStr)
		user.Rows = append(user.Rows, ptrOr(d.CommitUserName, "-"))
		ref.Rows = append(ref.Rows, d.CommitSha)
		message.Rows = append(message.Rows, ptrOr(d.CommitMessage, "-"))
	}

	return id, date, duration, status, user, ref, message
}

func printDeploymentsStyled(
	ce *clienv.CliEnv,
	deployments []*graphql.ListDeployments_Deployments,
) {
	id, date, duration, status, user, ref, message := buildDeploymentColumns(deployments)

	for i := range status.Rows {
		color := statusColor(status.Rows[i])
		status.Rows[i] = lipgloss.NewStyle().Foreground(color).Render(status.Rows[i])
	}

	ce.Println("%s", clienv.Table(id, date, duration, status, user, ref, message))
}

func printDeployments(
	ce *clienv.CliEnv,
	deployments []*graphql.ListDeployments_Deployments,
) {
	if term.IsTerminal(int(os.Stdout.Fd())) {
		printDeploymentsStyled(ce, deployments)

		return
	}

	id, date, duration, status, user, ref, message := buildDeploymentColumns(deployments)

	ce.Println("%s", clienv.Table(id, date, duration, status, user, ref, message))
}

func commandList(ctx context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	proj, err := cmdutil.GetAppInfoOrLink(ctx, ce, cmd.String(flagSubdomain))
	if err != nil {
		return fmt.Errorf("failed to get app info: %w", err)
	}

	cl, err := ce.GetNhostClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to get nhost client: %w", err)
	}

	deployments, err := cl.ListDeployments(
		ctx,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}

	printDeployments(ce, deployments.GetDeployments())

	return nil
}
