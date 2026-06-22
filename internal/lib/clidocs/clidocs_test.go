package clidocs_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/clidocs"
	"github.com/urfave/cli/v3"
)

// goldenPath is where the rendered reference fixture lives. Regenerate it with
// `UPDATE_GOLDEN=1 go test ./internal/lib/clidocs/` and review the diff by eye
// before committing.
const goldenPath = "testdata/commands.golden"

func noop(context.Context, *cli.Command) error { return nil }

// testCommand builds a synthetic command tree that exercises every rendering
// branch: global options (with default text, env vars, a bool, and the omitted
// help flag), a pure group, a runnable group with a child, leaf commands with
// the EXPERIMENTAL and BETA markers and aliases, a hidden command, an
// auto-generated help subcommand, and descriptions containing each codeify
// token class (path, <placeholder>, ENV_VAR, X-Header).
func testCommand() *cli.Command {
	return &cli.Command{
		Name:  "myapp",
		Usage: "do things with myapp",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "branch",
				Usage:       "Git branch name.\n\tDetected from the current repo at /path/to/repo if unset",
				DefaultText: "<current-git-branch>",
				Sources:     cli.EnvVars("MYAPP_BRANCH"),
			},
			&cli.StringFlag{
				Name:  "root-folder",
				Usage: "Root folder of project",
				Value: ".",
			},
			&cli.BoolFlag{
				Name:  "verbose",
				Usage: "Enable verbose output",
			},
			&cli.BoolFlag{
				Name:    "help",
				Aliases: []string{"h"},
				Usage:   "show help",
			},
		},
		Commands: []*cli.Command{
			{
				Name:  "config",
				Usage: "Manage configuration",
				Commands: []*cli.Command{
					{
						Name:  "apply",
						Usage: "Apply config to /etc/myapp and send the X-Config-Token header",
						Flags: []cli.Flag{
							&cli.StringFlag{
								Name:    "subdomain",
								Usage:   "Subdomain to apply to",
								Sources: cli.EnvVars("MYAPP_SUBDOMAIN"),
							},
							&cli.BoolFlag{
								Name:  "yes",
								Usage: "Skip confirmation",
							},
							&cli.BoolFlag{
								Name:    "help",
								Aliases: []string{"h"},
								Usage:   "show help",
							},
						},
					},
					// Auto-generated help subcommand: must be skipped.
					{Name: "help", Usage: "Shows a list of commands"},
				},
			},
			{
				Name:    "dev",
				Usage:   "Start the development environment",
				Aliases: []string{"d"},
				Action:  noop,
				Commands: []*cli.Command{
					{Name: "logs", Usage: "Show development logs", Action: noop},
				},
			},
			{
				Name:   "deploy",
				Usage:  "[EXPERIMENTAL] Create a deployment to the PROD_TARGET environment",
				Action: noop,
			},
			{
				Name:    "up",
				Usage:   "Start local development environment (BETA)",
				Aliases: []string{"u"},
				Action:  noop,
			},
			// Hidden command: must be skipped.
			{Name: "secret", Usage: "internal use only", Hidden: true, Action: noop},
		},
	}
}

func TestToMarkdownGolden(t *testing.T) {
	t.Parallel()

	got, err := clidocs.ToMarkdown(testCommand())
	if err != nil {
		t.Fatalf("ToMarkdown: %v", err)
	}

	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(goldenPath, []byte(got), 0o600); err != nil {
			t.Fatalf("write golden: %v", err)
		}
	}

	want, err := os.ReadFile(filepath.Clean(goldenPath))
	if err != nil {
		t.Fatalf("read golden (run with UPDATE_GOLDEN=1 to seed it): %v", err)
	}

	if got != string(want) {
		t.Errorf(
			"ToMarkdown output does not match %s; rerun with UPDATE_GOLDEN=1 if intentional.\n"+
				"--- got ---\n%s",
			goldenPath,
			got,
		)
	}
}

// TestToMarkdownNoSentinels guards against a regression to the old
// sentinel + sed pipeline: the generator must emit final MDX with no leftover
// %%...%% placeholders.
func TestToMarkdownNoSentinels(t *testing.T) {
	t.Parallel()

	got, err := clidocs.ToMarkdown(testCommand())
	if err != nil {
		t.Fatalf("ToMarkdown: %v", err)
	}

	if strings.Contains(got, "%%") {
		t.Errorf("output contains leftover %%%% sentinel(s):\n%s", got)
	}
}

// TestToMarkdownStructure checks the structural HTML and badges are emitted
// directly (not via post-processing) and that hidden/help commands are skipped.
func TestToMarkdownStructure(t *testing.T) {
	t.Parallel()

	got, err := clidocs.ToMarkdown(testCommand())
	if err != nil {
		t.Fatalf("ToMarkdown: %v", err)
	}

	for _, want := range []string{
		`<div class="cli-command cli-l0">`,
		`<div class="cli-body">`,
		`<span class="cli-badge cli-badge-experimental">Experimental</span>`,
		`<span class="cli-badge cli-badge-beta">Beta</span>`,
		// codeify keeps angle brackets literal inside a code span:
		"`<current-git-branch>`",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("output is missing %q", want)
		}
	}

	// The hidden command and the auto-generated help subcommand must be skipped.
	if strings.Contains(got, "myapp secret") {
		t.Error("hidden command leaked into output")
	}

	if strings.Contains(got, "Shows a list of commands") {
		t.Error("auto-generated help subcommand leaked into output")
	}

	// The help flag is shown in Global Options but omitted from per-command
	// option tables, so its description appears exactly once.
	if n := strings.Count(got, "show help."); n != 1 {
		t.Errorf("help flag description appears %d times, want 1 (global options only)", n)
	}
}
