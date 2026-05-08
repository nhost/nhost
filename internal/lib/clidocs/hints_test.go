package clidocs_test

import (
	"strings"
	"testing"

	"github.com/nhost/nhost/internal/lib/clidocs"
	"github.com/urfave/cli/v3"
)

func TestApplyHints(t *testing.T) {
	t.Parallel()

	root := &cli.Command{ //nolint:exhaustruct
		Name: "demo",
		Commands: []*cli.Command{
			{Name: "dev", Commands: []*cli.Command{{Name: "up"}, {Name: "down"}}}, //nolint:exhaustruct
			{Name: "login"}, //nolint:exhaustruct
		},
	}

	err := clidocs.ApplyHints(root, map[string]clidocs.AgentHints{
		"":         {PromptGuidelines: []string{"global rule"}},
		"dev up":   {PromptSnippet: "start"},
		"dev down": {PromptSnippet: "stop"},
		"login":    {PromptSnippet: "auth"},
	})
	if err != nil {
		t.Fatalf("ApplyHints: %v", err)
	}

	cases := map[string]string{
		"dev up":   "start",
		"dev down": "stop",
		"login":    "auth",
	}
	for path, want := range cases {
		cmd := walk(root, path)
		got, _ := cmd.Metadata["agent"].(clidocs.AgentHints)
		if got.PromptSnippet != want {
			t.Errorf("%q: promptSnippet = %q, want %q", path, got.PromptSnippet, want)
		}
	}
	rootHints, _ := root.Metadata["agent"].(clidocs.AgentHints)
	if len(rootHints.PromptGuidelines) != 1 || rootHints.PromptGuidelines[0] != "global rule" {
		t.Errorf("root guidelines = %v", rootHints.PromptGuidelines)
	}
}

func TestApplyHints_ReportsMissingPaths(t *testing.T) {
	t.Parallel()

	root := &cli.Command{Name: "demo"} //nolint:exhaustruct
	err := clidocs.ApplyHints(root, map[string]clidocs.AgentHints{
		"nope":     {},
		"also bad": {},
	})
	if err == nil {
		t.Fatal("expected error for missing paths")
	}
	if !strings.Contains(err.Error(), "nope") || !strings.Contains(err.Error(), "also bad") {
		t.Errorf("error doesn't list missing paths: %v", err)
	}
}

func walk(root *cli.Command, path string) *cli.Command {
	cmd := root
	for _, p := range strings.Fields(path) {
		for _, sub := range cmd.Commands {
			if sub.Name == p {
				cmd = sub
				break
			}
		}
	}
	return cmd
}
