package tool

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/nhost/nhost/services/ai/agents/provider"
)

// ErrToolNotFound is returned when a tool is not found in the registry.
var ErrToolNotFound = errors.New("tool not found")

// ErrDuplicateTool is returned by Register when a tool with the same name is
// already in the registry. Registration fails closed: a malicious or
// misconfigured MCP server cannot shadow a builtin (e.g. graphql_mutation)
// by registering a tool that reuses its name.
var ErrDuplicateTool = errors.New("duplicate tool")

// Tool is the interface for tools that can be used by agents.
//
// Execute is at-least-once with respect to client disconnect: a tool call may
// have begun before the SSE client dropped, completed remotely, and yet — even
// with detached persistence — be re-issued by the model on the next request if
// the result message could not be recorded in time. Tool authors whose actions
// have side effects (HTTP POSTs, GraphQL mutations, MCP server actions) are
// responsible for their own idempotency.
//
//go:generate mockgen -package mock -destination mock/tool.go github.com/nhost/nhost/services/ai/agents/tool Tool
type Tool interface {
	Definition() provider.ToolDefinition
	Execute(ctx context.Context, arguments string, logger *slog.Logger) (string, error)
}

// Registry holds registered tools.
type Registry struct {
	mu              sync.RWMutex
	tools           map[string]Tool
	requireApproval map[string]bool
}

// NewRegistry creates a new tool registry.
func NewRegistry() *Registry {
	return &Registry{
		mu:              sync.RWMutex{},
		tools:           make(map[string]Tool),
		requireApproval: make(map[string]bool),
	}
}

// Register adds a tool to the registry. Returns ErrDuplicateTool if a tool
// with the same name is already registered.
func (r *Registry) Register(t Tool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := t.Definition().Name
	if _, exists := r.tools[name]; exists {
		return fmt.Errorf("%w: %s", ErrDuplicateTool, name)
	}

	r.tools[name] = t

	return nil
}

// Get returns a tool by name.
func (r *Registry) Get(name string) (Tool, error) { //nolint:ireturn,nolintlint
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, ok := r.tools[name]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrToolNotFound, name)
	}

	return t, nil
}

// Definitions returns all tool definitions.
func (r *Registry) Definitions() []provider.ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	defs := make([]provider.ToolDefinition, 0, len(r.tools))
	for _, t := range r.tools {
		defs = append(defs, t.Definition())
	}

	return defs
}

// Len returns the number of registered tools.
func (r *Registry) Len() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.tools)
}

// SetRequiresApproval marks a tool as requiring approval before execution.
func (r *Registry) SetRequiresApproval(toolName string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.requireApproval[toolName] = true
}

// ClearRequiresApproval removes the approval requirement for a tool.
func (r *Registry) ClearRequiresApproval(toolName string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.requireApproval, toolName)
}

// RequiresApproval checks if a tool requires approval.
func (r *Registry) RequiresApproval(toolName string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.requireApproval[toolName]
}

// AnyRequiresApproval checks if any tool call in a batch requires approval.
func (r *Registry) AnyRequiresApproval(toolCalls []provider.ToolCall) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, tc := range toolCalls {
		if r.requireApproval[tc.Name] {
			return true
		}
	}

	return false
}
