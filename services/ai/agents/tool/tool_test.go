package tool_test

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/agents/tool"
)

type fakeTool struct {
	name   string
	result string
	err    error
}

func (f *fakeTool) Definition() provider.ToolDefinition {
	return provider.ToolDefinition{
		Name:        f.name,
		Description: "fake tool",
		Parameters:  map[string]any{},
	}
}

func (f *fakeTool) Execute(_ context.Context, _ string, _ *slog.Logger) (string, error) {
	return f.result, f.err
}

func mustRegister(t *testing.T, r *tool.Registry, tt tool.Tool) {
	t.Helper()

	if err := r.Register(tt); err != nil {
		t.Fatalf("unexpected register error for %q: %v", tt.Definition().Name, err)
	}
}

func TestRegistryRegisterAndGet(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	ft := &fakeTool{name: "test_tool", result: "ok", err: nil}
	if err := r.Register(ft); err != nil {
		t.Fatalf("unexpected register error: %v", err)
	}

	got, err := r.Get("test_tool")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if got.Definition().Name != "test_tool" {
		t.Errorf("expected name 'test_tool', got %q", got.Definition().Name)
	}
}

func TestRegistryGetNotFound(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	_, err := r.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !errors.Is(err, tool.ErrToolNotFound) {
		t.Errorf("expected ErrToolNotFound, got %v", err)
	}
}

func TestRegistryDefinitions(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()
	mustRegister(t, r, &fakeTool{name: "tool_a", result: "", err: nil})
	mustRegister(t, r, &fakeTool{name: "tool_b", result: "", err: nil})

	defs := r.Definitions()
	if len(defs) != 2 {
		t.Fatalf("expected 2 definitions, got %d", len(defs))
	}

	names := make(map[string]bool)
	for _, d := range defs {
		names[d.Name] = true
	}

	if !names["tool_a"] || !names["tool_b"] {
		t.Errorf("expected tool_a and tool_b, got %v", names)
	}
}

func TestRegistryLen(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	if r.Len() != 0 {
		t.Errorf("expected 0, got %d", r.Len())
	}

	mustRegister(t, r, &fakeTool{name: "t1", result: "", err: nil})

	if r.Len() != 1 {
		t.Errorf("expected 1, got %d", r.Len())
	}
}

func TestRegistryRequiresApproval(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	if r.RequiresApproval("some_tool") {
		t.Error("expected false for unknown tool")
	}

	r.SetRequiresApproval("some_tool")

	if !r.RequiresApproval("some_tool") {
		t.Error("expected true after SetRequiresApproval")
	}

	r.ClearRequiresApproval("some_tool")

	if r.RequiresApproval("some_tool") {
		t.Error("expected false after ClearRequiresApproval")
	}
}

func TestRegistryAnyRequiresApproval(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	calls := []provider.ToolCall{
		{ID: "tc1", Name: "safe", Arguments: "{}"},
		{ID: "tc2", Name: "dangerous", Arguments: "{}"},
	}

	if r.AnyRequiresApproval(calls) {
		t.Error("expected false when no tools require approval")
	}

	r.SetRequiresApproval("dangerous")

	if !r.AnyRequiresApproval(calls) {
		t.Error("expected true when one tool requires approval")
	}

	if r.AnyRequiresApproval(nil) {
		t.Error("expected false for empty tool calls")
	}

	safeCalls := []provider.ToolCall{
		{ID: "tc1", Name: "safe", Arguments: "{}"},
	}

	if r.AnyRequiresApproval(safeCalls) {
		t.Error("expected false when no matching tools require approval")
	}
}

// TestRegistryRegisterRejectsDuplicate asserts that re-registering a name
// fails with ErrDuplicateTool and leaves the original tool in place. This is
// the guard that prevents an MCP server from shadowing a builtin like
// graphql_mutation by exposing a tool with the same name.
func TestRegistryRegisterRejectsDuplicate(t *testing.T) {
	t.Parallel()

	r := tool.NewRegistry()

	if err := r.Register(&fakeTool{name: "t1", result: "first", err: nil}); err != nil {
		t.Fatalf("unexpected first register error: %v", err)
	}

	err := r.Register(&fakeTool{name: "t1", result: "second", err: nil})
	if err == nil {
		t.Fatal("expected ErrDuplicateTool on second register, got nil")
	}

	if !errors.Is(err, tool.ErrDuplicateTool) {
		t.Errorf("expected ErrDuplicateTool, got %v", err)
	}

	if r.Len() != 1 {
		t.Errorf("expected 1 entry after rejected duplicate, got %d", r.Len())
	}

	got, err := r.Get("t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	result, err := got.Execute(context.Background(), "", slog.Default())
	if err != nil {
		t.Fatalf("unexpected execute error: %v", err)
	}

	if result != "first" {
		t.Errorf("expected original 'first' to be preserved, got %q", result)
	}
}
