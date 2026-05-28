// Package report wires the CLI surface for ghactivity's only command:
// collecting a user's GitHub activity over a window and printing markdown.
package report

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/nhost/nhost/tools/ghactivity/internal/activity"
	"github.com/nhost/nhost/tools/ghactivity/internal/gh"
	"github.com/nhost/nhost/tools/ghactivity/internal/render"
	"github.com/urfave/cli/v3"
)

const (
	flagOrg           = "org"
	flagSince         = "since"
	flagUntil         = "until"
	flagUser          = "user"
	flagOutput        = "output"
	flagStatusField   = "status-field"
	flagReadyStatus   = "ready-status"
	flagWaitingStatus = "waiting-status"

	timestampLayout = "20060102-1504"

	defaultReadyStatus   = "Ready for review"
	defaultWaitingStatus = "Waiting"
)

// Flags returns the urfave/cli flag set for the ghactivity command.
func Flags() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagOrg,
			Aliases:  []string{"o"},
			Usage:    "GitHub organisation to scope the search to",
			Required: true,
			Sources:  cli.EnvVars("GHACTIVITY_ORG"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:     flagSince,
			Aliases:  []string{"s"},
			Usage:    "Start of the activity window, format YYYYMMDD-HHMM (local time)",
			Required: true,
			Sources:  cli.EnvVars("GHACTIVITY_SINCE"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagUntil,
			Aliases: []string{"e"},
			Usage:   "End of the activity window, format YYYYMMDD-HHMM (defaults to now)",
			Sources: cli.EnvVars("GHACTIVITY_UNTIL"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagUser,
			Aliases: []string{"u"},
			Usage:   "GitHub login to report on (defaults to the authenticated gh user)",
			Sources: cli.EnvVars("GHACTIVITY_USER"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagOutput,
			Usage:   "Write the markdown to this file (defaults to stdout)",
			Sources: cli.EnvVars("GHACTIVITY_OUTPUT"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name: flagStatusField,
			Usage: "GitHub Projects v2 single-select field name that holds the " +
				"status column (e.g. 'Status', 'Workflow Status', 'Stage')",
			Value:   activity.DefaultStatusField,
			Sources: cli.EnvVars("GHACTIVITY_STATUS_FIELD"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagReadyStatus,
			Usage:   "GitHub Project status name that means 'ready for review'",
			Value:   defaultReadyStatus,
			Sources: cli.EnvVars("GHACTIVITY_READY_STATUS"),
		},
		&cli.StringFlag{ //nolint:exhaustruct
			Name:    flagWaitingStatus,
			Usage:   "GitHub Project status name that means 'blocked / waiting'",
			Value:   defaultWaitingStatus,
			Sources: cli.EnvVars("GHACTIVITY_WAITING_STATUS"),
		},
	}
}

// Action collects activity and writes the markdown report.
func Action(ctx context.Context, c *cli.Command) error {
	// gosmopolitan flags time.Local; here it's intentional — the --since/--until
	// values are typed by a human in their own time zone for a daily stand-up.
	loc := time.Local //nolint:gosmopolitan

	since, err := ParseTimestamp(c.String(flagSince), loc)
	if err != nil {
		return cli.Exit(fmt.Sprintf("invalid --%s: %v", flagSince, err), 1)
	}

	until := time.Now()
	if raw := c.String(flagUntil); raw != "" {
		until, err = ParseTimestamp(raw, loc)
		if err != nil {
			return cli.Exit(fmt.Sprintf("invalid --%s: %v", flagUntil, err), 1)
		}
	}

	if !until.After(since) {
		return cli.Exit("--until must be after --since", 1)
	}

	client, err := gh.New()
	if err != nil {
		return cli.Exit(fmt.Sprintf("initialising gh client: %v", err), 1)
	}

	user := c.String(flagUser)
	if user == "" {
		user, err = client.AuthenticatedLogin(ctx)
		if err != nil {
			return cli.Exit(fmt.Sprintf("resolving authenticated user: %v", err), 1)
		}
	}

	report, err := activity.Build(ctx, client, activity.Params{
		Org:           c.String(flagOrg),
		User:          user,
		Since:         since,
		Until:         until,
		StatusField:   c.String(flagStatusField),
		ReadyStatus:   c.String(flagReadyStatus),
		WaitingStatus: c.String(flagWaitingStatus),
	})
	if err != nil {
		if errors.Is(err, gh.ErrMissingScope) {
			return cli.Exit(
				"gh token is missing the 'read:project' scope, which ghactivity needs to read "+
					"GitHub Projects v2 status. Grant it with:\n\n"+
					"    gh auth refresh -h github.com -s read:project,project\n",
				1,
			)
		}

		return cli.Exit(fmt.Sprintf("collecting activity: %v", err), 1)
	}

	return writeReport(c.String(flagOutput), report)
}

// writeReport opens the destination (stdout if path is empty) and renders the
// markdown report into it.
func writeReport(path string, report *activity.Report) error {
	out := os.Stdout
	if path != "" {
		f, err := os.Create(path)
		if err != nil {
			return cli.Exit(fmt.Sprintf("opening output file: %v", err), 1)
		}
		defer f.Close()

		out = f
	}

	if err := render.Markdown(out, report); err != nil {
		return cli.Exit(fmt.Sprintf("rendering markdown: %v", err), 1)
	}

	return nil
}

// ParseTimestamp parses the YYYYMMDD-HHMM format in the given location.
func ParseTimestamp(s string, loc *time.Location) (time.Time, error) {
	t, err := time.ParseInLocation(timestampLayout, s, loc)
	if err != nil {
		return time.Time{}, fmt.Errorf("parsing %q as %s: %w", s, timestampLayout, err)
	}

	return t, nil
}
