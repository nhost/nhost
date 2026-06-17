package clidocs_test

import (
	"encoding/json"
	"testing"

	"github.com/nhost/nhost/internal/lib/clidocs"
	"github.com/urfave/cli/v3"
)

func TestWithAgent_RoundTripsThroughJSON(t *testing.T) {
	t.Parallel()

	root := clidocs.WithAgent(&cli.Command{ //nolint:exhaustruct
		Name:  "demo",
		Usage: "demo",
		Commands: []*cli.Command{
			clidocs.WithAgent(&cli.Command{ //nolint:exhaustruct
				Name:  "up",
				Usage: "Start the dev stack",
			}, clidocs.AgentHints{
				PromptSnippet:    "Start the local dev stack.",
				PromptGuidelines: []string{"Run 'demo project link' first if not in a linked project."},
				LongRunning:      true,
				ExecutionMode:    "sequential",
				Examples: []clidocs.AgentExample{
					{Args: []string{"up"}, Description: "default"},
					{Args: []string{"up", "--port", "1337"}, Description: "custom port"},
				},
				Notes: "Holds the terminal until interrupted.",
			}),
		},
	}, clidocs.AgentHints{
		PromptGuidelines: []string{"Always use --branch when in a branchful repo."},
	})

	b, err := clidocs.ToJSON(root)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}

	var got clidocs.CmdJSON
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, b)
	}

	if got.Agent == nil {
		t.Fatal("root.agent missing")
	}
	if len(got.Agent.PromptGuidelines) != 1 || got.Agent.PromptGuidelines[0] != "Always use --branch when in a branchful repo." {
		t.Errorf("root.agent.promptGuidelines = %v", got.Agent.PromptGuidelines)
	}

	if len(got.Commands) != 1 {
		t.Fatalf("expected 1 subcommand, got %d", len(got.Commands))
	}
	up := got.Commands[0].Agent
	if up == nil {
		t.Fatal("up.agent missing")
	}
	if up.PromptSnippet != "Start the local dev stack." {
		t.Errorf("up.agent.promptSnippet = %q", up.PromptSnippet)
	}
	if !up.LongRunning {
		t.Errorf("up.agent.longRunning should be true")
	}
	if up.ExecutionMode != "sequential" {
		t.Errorf("up.agent.executionMode = %q", up.ExecutionMode)
	}
	if len(up.Examples) != 2 {
		t.Errorf("up.agent.examples len = %d", len(up.Examples))
	}
}

func TestExtractAgentHints_AcceptsUntypedMap(t *testing.T) {
	t.Parallel()

	cmd := &cli.Command{ //nolint:exhaustruct
		Name: "demo",
		Metadata: map[string]any{
			"agent": map[string]any{
				"promptSnippet":    "hello",
				"promptGuidelines": []string{"do x", "do y"},
				"destructive":      true,
			},
		},
	}

	b, err := clidocs.ToJSON(cmd)
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}
	var got clidocs.CmdJSON
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Agent == nil || got.Agent.PromptSnippet != "hello" || !got.Agent.Destructive || len(got.Agent.PromptGuidelines) != 2 {
		t.Errorf("got = %+v", got.Agent)
	}
}

func TestNoAgentMetadata_OmitsAgentField(t *testing.T) {
	t.Parallel()

	b, err := clidocs.ToJSON(&cli.Command{Name: "demo"}) //nolint:exhaustruct
	if err != nil {
		t.Fatalf("ToJSON: %v", err)
	}
	if json.Valid(b) == false {
		t.Fatalf("invalid json: %s", b)
	}
	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, present := raw["agent"]; present {
		t.Errorf("expected 'agent' key absent, got: %v", raw)
	}
}
