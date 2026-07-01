package deployments

import (
	"context"
	"encoding/json"
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

const flagJSON = "json"

func CommandList() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:    "list",
		Aliases: []string{},
		Usage:   "List deployments in the cloud environment",
		Action:  commandList,
		Flags: append(commonFlags(), &cli.BoolFlag{ //nolint:exhaustruct
			Name:  flagJSON,
			Usage: "Output as JSON",
		}),
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
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
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

		statusStr := ptrOr(d.Status, "UNKNOWN")
		id.Rows = append(id.Rows, ptrOr(d.ID, "-"))
		date.Rows = append(date.Rows, startedAt.Format(time.RFC3339))
		duration.Rows = append(duration.Rows, deplDuration.String())
		status.Rows = append(status.Rows, statusStr)
		user.Rows = append(user.Rows, ptrOr(d.CommitUserName, "-"))
		ref.Rows = append(ref.Rows, ptrOr(d.CommitSha, "-"))
		message.Rows = append(message.Rows, ptrOr(d.CommitMessage, "-"))
	}

	return id, date, duration, status, user, ref, message
}

func printDeploymentsStyled(
	ce *clienv.CliEnv,
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
) {
	id, date, duration, status, user, ref, message := buildDeploymentColumns(deployments)

	for i := range status.Rows {
		color := statusColor(status.Rows[i])
		status.Rows[i] = lipgloss.NewStyle().Foreground(color).Render(status.Rows[i])
	}

	ce.Println("%s", clienv.Table(id, date, duration, status, user, ref, message))
}

type deploymentJSON struct {
	ID       string `json:"id"`
	Date     string `json:"date"`
	Duration string `json:"duration"`
	Status   string `json:"status"`
	User     string `json:"user"`
	Ref      string `json:"ref"`
	Message  string `json:"message"`
}

func buildDeploymentJSON(
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
) []deploymentJSON {
	result := make([]deploymentJSON, 0, len(deployments))

	for _, d := range deployments {
		var startedAt time.Time
		if d.StartedAt != nil && !d.StartedAt.IsZero() {
			startedAt = *d.StartedAt
		}

		var deplDuration time.Duration
		if d.EndedAt != nil && !d.EndedAt.IsZero() {
			deplDuration = d.EndedAt.Sub(startedAt)
		}

		result = append(result, deploymentJSON{
			ID:       ptrOr(d.ID, "-"),
			Date:     startedAt.Format(time.RFC3339),
			Duration: deplDuration.String(),
			Status:   ptrOr(d.Status, "UNKNOWN"),
			User:     ptrOr(d.CommitUserName, "-"),
			Ref:      ptrOr(d.CommitSha, "-"),
			Message:  ptrOr(d.CommitMessage, "-"),
		})
	}

	return result
}

func printDeploymentsPlain(
	ce *clienv.CliEnv,
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
) {
	for _, d := range deployments {
		status := ptrOr(d.Status, "UNKNOWN")
		date := ""

		if d.StartedAt != nil {
			date = d.StartedAt.Format("2006-01-02 15:04")
		}

		idStr := ptrOr(d.ID, "-")
		if len(idStr) > 8 { //nolint:mnd
			idStr = idStr[:8]
		}

		ce.Println(
			"%s  %s  %s  %s",
			idStr,
			date,
			status,
			ptrOr(d.CommitMessage, ""),
		)
	}
}

func printDeploymentsJSON(
	deployments []*graphql.ListUnifiedDeployments_UnifiedDeployments,
) error {
	if err := json.NewEncoder(os.Stdout).Encode(buildDeploymentJSON(deployments)); err != nil {
		return fmt.Errorf("failed to encode JSON: %w", err)
	}

	return nil
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

	deployments, err := cl.ListUnifiedDeployments(
		ctx,
		proj.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to get deployments: %w", err)
	}

	if cmd.Bool(flagJSON) {
		return printDeploymentsJSON(deployments.GetUnifiedDeployments())
	}

	isTTY := term.IsTerminal(int(os.Stdout.Fd()))
	if isTTY {
		printDeploymentsStyled(ce, deployments.GetUnifiedDeployments())
	} else {
		printDeploymentsPlain(ce, deployments.GetUnifiedDeployments())
	}

	return nil
}
