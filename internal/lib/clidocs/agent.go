package clidocs

import (
	"encoding/json"

	"github.com/urfave/cli/v3"
)

const agentMetadataKey = "agent"

type AgentHints struct {
	PromptSnippet    string         `json:"promptSnippet,omitempty"`
	PromptGuidelines []string       `json:"promptGuidelines,omitempty"`
	Destructive      bool           `json:"destructive,omitempty"`
	LongRunning      bool           `json:"longRunning,omitempty"`
	RequiresAuth     bool           `json:"requiresAuth,omitempty"`
	ExecutionMode    string         `json:"executionMode,omitempty"`
	Examples         []AgentExample `json:"examples,omitempty"`
	Notes            string         `json:"notes,omitempty"`
}

type AgentExample struct {
	Args        []string `json:"args"`
	Description string   `json:"description"`
}

func WithAgent(cmd *cli.Command, hints AgentHints) *cli.Command {
	if cmd.Metadata == nil {
		cmd.Metadata = map[string]any{}
	}
	cmd.Metadata[agentMetadataKey] = hints
	return cmd
}

func extractAgentHints(cmd *cli.Command) *AgentHints {
	v, ok := cmd.Metadata[agentMetadataKey]
	if !ok || v == nil {
		return nil
	}
	if h, ok := v.(AgentHints); ok {
		return &h
	}
	if h, ok := v.(*AgentHints); ok {
		return h
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var h AgentHints
	if err := json.Unmarshal(raw, &h); err != nil {
		return nil
	}
	return &h
}
