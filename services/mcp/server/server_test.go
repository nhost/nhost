package server_test

import (
	"context"
	"fmt"
	"log/slog"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/nhost/nhost/services/mcp/server"
	"github.com/nhost/nhost/services/mcp/tools"
	"github.com/urfave/cli/v3"
)

func TestServer(t *testing.T) { //nolint:paralleltest
	tests := []struct {
		name                 string
		args                 []string
		expectedInstructions string
		expectedTools        *mcp.ListToolsResult
	}{
		{
			name: "default instructions",
			args: []string{
				"mcp",
				"--graphql-endpoint=http://localhost:8080/v1/graphql",
				"--auth-url=http://localhost:4000",
			},
			expectedInstructions: "",
			expectedTools:        defaultTools(),
		},
		{
			name: "custom instructions",
			args: []string{
				"mcp",
				"--graphql-endpoint=http://localhost:8080/v1/graphql",
				"--auth-url=http://localhost:4000",
				"--mcp-instructions=Custom server instructions",
				"--query-instructions=Custom query instructions",
				"--mutation-instructions=Custom mutation instructions",
				"--schema-instructions=Custom schema instructions",
			},
			expectedInstructions: "Custom server instructions",
			expectedTools:        customTools(),
		},
	}

	for _, tc := range tests { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			cmd := server.Command("")

			cmd.Action = func(ctx context.Context, cmd *cli.Command) error {
				logger := slog.New(slog.DiscardHandler)

				s, err := server.BuildServer(ctx, logger, cmd)
				if err != nil {
					return fmt.Errorf("problem building server: %w", err)
				}

				mcpClient, err := client.NewInProcessClient(s)
				if err != nil {
					t.Fatalf(
						"failed to create in-process client: %v",
						err,
					)
				}

				t.Cleanup(func() { mcpClient.Close() })

				//nolint:contextcheck
				runTests(t, mcpClient, tc.expectedInstructions, tc.expectedTools)

				return nil
			}

			if err := cmd.Run(
				context.Background(),
				tc.args,
			); err != nil {
				t.Fatalf("failed to run mcp command: %v", err)
			}
		})
	}
}

func runTests(
	t *testing.T,
	mcpClient *client.Client,
	expectedInstructions string,
	expectedTools *mcp.ListToolsResult,
) {
	t.Helper()

	if err := mcpClient.Start(t.Context()); err != nil {
		t.Fatalf("failed to start mcp client: %v", err)
	}

	initRequest := mcp.InitializeRequest{} //nolint:exhaustruct
	initRequest.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	initRequest.Params.ClientInfo = mcp.Implementation{
		Name:    "test-client",
		Version: "1.0.0",
	}

	res, err := mcpClient.Initialize(
		context.Background(),
		initRequest,
	)
	if err != nil {
		t.Fatalf("failed to initialize mcp client: %v", err)
	}

	//nolint:tagalign
	if diff := cmp.Diff(
		res,
		&mcp.InitializeResult{
			ProtocolVersion: "2025-06-18",
			Capabilities: mcp.ServerCapabilities{
				Elicitation:  nil,
				Experimental: nil,
				Logging:      nil,
				Prompts:      nil,
				Resources:    nil,
				Sampling:     nil,
				Tools: &struct {
					ListChanged bool "json:\"listChanged,omitempty\""
				}{
					ListChanged: true,
				},
			},
			ServerInfo: mcp.Implementation{
				Name:    "mcp",
				Version: "",
			},
			Instructions: expectedInstructions,
			Result: mcp.Result{
				Meta: nil,
			},
		},
	); diff != "" {
		t.Errorf("InitializeResult mismatch (-want +got):\n%s", diff)
	}

	toolsList, err := mcpClient.ListTools(
		context.Background(),
		mcp.ListToolsRequest{}, //nolint:exhaustruct
	)
	if err != nil {
		t.Fatalf("failed to list tools: %v", err)
	}

	if diff := cmp.Diff(
		toolsList,
		expectedTools,
		cmpopts.SortSlices(func(a, b mcp.Tool) bool {
			return a.Name < b.Name
		}),
	); diff != "" {
		t.Errorf("ListToolsResult mismatch (-want +got):\n%s", diff)
	}
}

func defaultTools() *mcp.ListToolsResult {
	return &mcp.ListToolsResult{ //nolint:exhaustruct
		Tools: []mcp.Tool{
			{ //nolint:exhaustruct
				Name:        "get-schema",
				Description: tools.DefaultSchemaInstructions,
				InputSchema: mcp.ToolInputSchema{ //nolint:exhaustruct
					Type: "object",
					Properties: map[string]any{
						"summary": map[string]any{
							"default":     bool(true),
							"description": string("only return a summary of the schema"),
							"type":        string("boolean"),
						},
						"queries": map[string]any{
							"description": string(
								"list of query names to include in the schema",
							),
							"type":  string("array"),
							"items": map[string]any{"type": string("string")},
						},
						"mutations": map[string]any{
							"description": string(
								"list of mutation names to include in the schema",
							),
							"type":  string("array"),
							"items": map[string]any{"type": string("string")},
						},
					},
				},
				Annotations: mcp.ToolAnnotation{
					Title:           "Get GraphQL Schema",
					ReadOnlyHint:    new(true),
					DestructiveHint: new(false),
					IdempotentHint:  new(true),
					OpenWorldHint:   new(true),
				},
			},
			{ //nolint:exhaustruct
				Name:        "graphql-mutation",
				Description: tools.DefaultMutationInstructions,
				InputSchema: mcp.ToolInputSchema{ //nolint:exhaustruct
					Type: "object",
					Properties: map[string]any{
						"query": map[string]any{
							"description": "GraphQL mutation to execute",
							"type":        "string",
						},
						"variables": map[string]any{
							"description": "variables to use in the mutation",
							"type":        "object",
							"properties":  map[string]any{},
						},
					},
					Required: []string{"query"},
				},
				Annotations: mcp.ToolAnnotation{
					Title:           "Execute GraphQL Mutation",
					ReadOnlyHint:    new(false),
					DestructiveHint: new(true),
					IdempotentHint:  new(false),
					OpenWorldHint:   new(true),
				},
			},
			{ //nolint:exhaustruct
				Name:        "graphql-query",
				Description: tools.DefaultQueryInstructions,
				InputSchema: mcp.ToolInputSchema{ //nolint:exhaustruct
					Type: "object",
					Properties: map[string]any{
						"query": map[string]any{
							"description": "GraphQL query to execute",
							"type":        "string",
						},
						"variables": map[string]any{
							"description": "variables to use in the query",
							"type":        "object",
							"properties":  map[string]any{},
						},
					},
					Required: []string{"query"},
				},
				Annotations: mcp.ToolAnnotation{
					Title:           "Execute GraphQL Query",
					ReadOnlyHint:    new(true),
					DestructiveHint: new(false),
					IdempotentHint:  new(true),
					OpenWorldHint:   new(true),
				},
			},
		},
	}
}

func customTools() *mcp.ListToolsResult {
	result := defaultTools()
	for i := range result.Tools {
		switch result.Tools[i].Name {
		case "graphql-query":
			result.Tools[i].Description = "Custom query instructions"
		case "graphql-mutation":
			result.Tools[i].Description = "Custom mutation instructions"
		case "get-schema":
			result.Tools[i].Description = "Custom schema instructions"
		}
	}

	return result
}
