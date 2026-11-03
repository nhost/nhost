package server_test

import (
	"context"
	"fmt"
	"slices"
	"testing"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/server"
	"github.com/urfave/cli/v3"
)

func TestServerStorage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		storageURL string
		wantError  bool
	}{
		{"enabled", "https://backend.storage.example/v1", false},
		{"invalid storage URL", "relative/path", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cmd := server.Command("")
			cmd.Action = func(ctx context.Context, cmd *cli.Command) error {
				s, err := server.BuildServer(cmd)
				if tt.wantError {
					if err == nil {
						t.Error("invalid storage URL must fail startup")
					}

					return nil
				}

				if err != nil {
					return fmt.Errorf("building server: %w", err)
				}

				return checkServerStorageTools(ctx, t, s)
			}

			if err := cmd.Run(
				t.Context(),
				[]string{
					"mcp",
					"--graphql-endpoint=http://localhost:8080/v1/graphql",
					"--auth-url=http://localhost:4000",
					"--storage-url=" + tt.storageURL,
				},
			); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func checkServerStorageTools(ctx context.Context, t *testing.T, s *mcpserver.MCPServer) error {
	t.Helper()

	c, err := client.NewInProcessClient(s)
	if err != nil {
		return fmt.Errorf("creating client: %w", err)
	}

	t.Cleanup(func() { c.Close() })

	if err := c.Start(ctx); err != nil {
		return fmt.Errorf("starting client: %w", err)
	}

	init := mcp.InitializeRequest{}
	init.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	init.Params.ClientInfo = mcp.Implementation{Name: "test", Version: "test"}

	if _, err := c.Initialize(ctx, init); err != nil {
		return fmt.Errorf("initializing client: %w", err)
	}

	list, err := c.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		return fmt.Errorf("listing tools: %w", err)
	}

	names := make([]string, 0, len(list.Tools))
	for _, tool := range list.Tools {
		names = append(names, tool.Name)
	}

	slices.Sort(names)

	want := []string{
		"get-schema",
		"graphql-mutation",
		"graphql-query",
		"storage-delete",
		"storage-download",
		"storage-update",
		"storage-upload",
	}
	if !slices.Equal(names, want) {
		t.Errorf("tools = %v, want %v", names, want)
	}

	return nil
}
