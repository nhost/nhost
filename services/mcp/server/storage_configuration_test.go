package server_test

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/server"
	"github.com/urfave/cli/v3"
)

func TestStorageLimitConfiguration(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		flags     []string
		transfer  int64
		request   int64
		wantError bool
	}{
		{"defaults allow 50 MB files", nil, 50_000_000, 70_000_000, false},
		{
			"lower budgets",
			[]string{"--storage-max-transfer-bytes=123", "--storage-max-request-bytes=1024"},
			123,
			1024,
			false,
		},
		{
			"higher budgets",
			[]string{
				"--storage-max-transfer-bytes=100000000",
				"--storage-max-request-bytes=150000000",
			},
			100_000_000,
			150_000_000,
			false,
		},
		{"zero transfer", []string{"--storage-max-transfer-bytes=0"}, 0, 70_000_000, true},
		{"negative transfer", []string{"--storage-max-transfer-bytes=-1"}, -1, 70_000_000, true},
		{
			"overflowing transfer sentinel",
			[]string{"--storage-max-transfer-bytes=" + strconv.FormatInt(math.MaxInt64, 10)},
			math.MaxInt64,
			70_000_000,
			true,
		},
		{"zero request", []string{"--storage-max-request-bytes=0"}, 50_000_000, 0, true},
		{"negative request", []string{"--storage-max-request-bytes=-1"}, 50_000_000, -1, true},
		{
			"overflowing request sentinel",
			[]string{"--storage-max-request-bytes=" + strconv.FormatInt(math.MaxInt64, 10)},
			50_000_000,
			math.MaxInt64,
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cmd := server.Command("")
			cmd.Action = func(ctx context.Context, cmd *cli.Command) error {
				if cmd.Int64(server.FlagStorageMaxTransferBytes) != tt.transfer ||
					cmd.Int64(server.FlagStorageMaxRequestBytes) != tt.request {
					t.Error("unexpected CLI limit values")
				}

				s, err := server.BuildServer(cmd)
				if tt.wantError {
					if err == nil {
						t.Error("invalid storage limits should fail startup")
					}

					return nil
				}

				if err != nil {
					return fmt.Errorf("building server with configured limits: %w", err)
				}

				return checkStorageLimitDescriptions(ctx, t, s, tt.transfer)
			}

			args := []string{
				"mcp",
				"--graphql-endpoint=http://graphql/v1/graphql",
				"--auth-url=http://auth/v1",
				"--storage-url=http://storage/v1",
			}
			if err := cmd.Run(t.Context(), append(args, tt.flags...)); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func checkStorageLimitDescriptions(
	ctx context.Context,
	t *testing.T,
	s *mcpserver.MCPServer,
	limit int64,
) error {
	t.Helper()

	c, err := client.NewInProcessClient(s)
	if err != nil {
		return fmt.Errorf("creating MCP client: %w", err)
	}

	t.Cleanup(func() { c.Close() })

	if err := c.Start(ctx); err != nil {
		return fmt.Errorf("starting MCP client: %w", err)
	}

	init := mcp.InitializeRequest{}
	init.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION

	init.Params.ClientInfo = mcp.Implementation{Name: "test", Version: "test"}
	if _, err := c.Initialize(ctx, init); err != nil {
		return fmt.Errorf("initializing MCP client: %w", err)
	}

	result, err := c.ListTools(ctx, mcp.ListToolsRequest{})
	if err != nil {
		return fmt.Errorf("listing tools: %w", err)
	}

	for _, tool := range result.Tools {
		if tool.Name == "storage-upload" || tool.Name == "storage-download" ||
			tool.Name == "storage-update" {
			if !strings.Contains(tool.Description, strconv.FormatInt(limit, 10)+" bytes") {
				t.Errorf(
					"%s description does not show configured limit: %s",
					tool.Name,
					tool.Description,
				)
			}
		}
	}

	return nil
}

func TestStorageLimitEnvironment(
	t *testing.T,
) {
	t.Setenv("MCP_STORAGE_MAX_TRANSFER_BYTES", "90000000")
	t.Setenv("MCP_STORAGE_MAX_REQUEST_BYTES", "140000000")

	cmd := server.Command("")
	cmd.Action = func(_ context.Context, cmd *cli.Command) error {
		if cmd.Int64(server.FlagStorageMaxTransferBytes) != 90_000_000 ||
			cmd.Int64(server.FlagStorageMaxRequestBytes) != 140_000_000 {
			t.Error("storage limits were not loaded from environment")
		}

		if _, err := server.BuildServer(cmd); err != nil {
			return fmt.Errorf("building server with environment limits: %w", err)
		}

		return nil
	}

	if err := cmd.Run(
		t.Context(),
		[]string{
			"mcp",
			"--graphql-endpoint=http://graphql/v1/graphql",
			"--auth-url=http://auth/v1",
			"--storage-url=http://storage/v1",
		},
	); err != nil {
		t.Fatal(err)
	}
}
