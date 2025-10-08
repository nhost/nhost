package mcp_test

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	nhostmcp "github.com/nhost/nhost/cli/cmd/mcp"
	"github.com/nhost/nhost/cli/cmd/mcp/start"
	"github.com/nhost/nhost/cli/cmd/user"
	"github.com/nhost/nhost/cli/mcp/tools/cloud"
	"github.com/nhost/nhost/cli/mcp/tools/docs"
	"github.com/nhost/nhost/cli/mcp/tools/project"
	"github.com/nhost/nhost/cli/mcp/tools/schemas"
)

func ptr[T any](v T) *T {
	return &v
}

func TestStart(t *testing.T) { //nolint:cyclop,maintidx,paralleltest
	loginCmd := user.CommandLogin()
	mcpCmd := nhostmcp.Command()

	buf := bytes.NewBuffer(nil)
	mcpCmd.Writer = buf

	go func() {
		t.Setenv("HOME", t.TempDir())

		if err := loginCmd.Run(
			context.Background(),
			[]string{
				"main",
				"--pat=user-pat",
			},
		); err != nil {
			panic(err)
		}

		if err := mcpCmd.Run(
			context.Background(),
			[]string{
				"main",
				"start",
				"--bind=:9000",
				"--config-file=testdata/sample.toml",
			},
		); err != nil {
			panic(err)
		}
	}()

	time.Sleep(time.Second)

	transportClient, err := transport.NewSSE("http://localhost:9000/sse")
	if err != nil {
		t.Fatalf("failed to create transport client: %v", err)
	}

	mcpClient := client.NewClient(transportClient)

	if err := mcpClient.Start(t.Context()); err != nil {
		t.Fatalf("failed to start mcp client: %v", err)
	}
	defer mcpClient.Close()

	initRequest := mcp.InitializeRequest{} //nolint:exhaustruct
	initRequest.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	initRequest.Params.ClientInfo = mcp.Implementation{
		Name:    "example-client",
		Version: "1.0.0",
	}

	res, err := mcpClient.Initialize(
		context.Background(),
		initRequest,
	)
	if err != nil {
		t.Fatalf("failed to initialize mcp client: %v", err)
	}

	if diff := cmp.Diff(
		res,
		//nolint:tagalign
		&mcp.InitializeResult{
			ProtocolVersion: "2025-06-18",
			Capabilities: mcp.ServerCapabilities{
				Elicitation:  nil,
				Experimental: nil,
				Logging:      nil,
				Prompts:      nil,
				Resources: &struct {
					Subscribe   bool "json:\"subscribe,omitempty\""
					ListChanged bool "json:\"listChanged,omitempty\""
				}{
					Subscribe:   false,
					ListChanged: false,
				},
				Sampling: nil,
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
			Instructions: start.ServerInstructions + `Configured projects:
- local (local): Local development project running via the Nhost CLI
- asdasdasdasdasd (eu-central-1): Staging project for my awesome app
- qweqweqweqweqwe (us-east-1): Production project for my awesome app
`,
			Result: mcp.Result{
				Meta: nil,
			},
		},
	); diff != "" {
		t.Errorf("ServerInfo mismatch (-want +got):\n%s", diff)
	}

	tools, err := mcpClient.ListTools(
		context.Background(),
		mcp.ListToolsRequest{}, //nolint:exhaustruct
	)
	if err != nil {
		t.Fatalf("failed to list tools: %v", err)
	}

	if diff := cmp.Diff(
		tools,
		//nolint:exhaustruct,lll
		&mcp.ListToolsResult{
			Tools: []mcp.Tool{
				{
					Name:        "cloud-graphql-query",
					Description: cloud.ToolGraphqlQueryInstructions,
					InputSchema: mcp.ToolInputSchema{
						Type: "object",
						Properties: map[string]any{
							"query": map[string]any{
								"description": "graphql query to perform",
								"type":        "string",
							},
							"variables": map[string]any{
								"description": "variables to use in the query",
								"type":        "string",
							},
						},
						Required: []string{"query"},
					},
					Annotations: mcp.ToolAnnotation{
						Title:           "Perform GraphQL Query on Nhost Cloud Platform",
						ReadOnlyHint:    ptr(false),
						DestructiveHint: ptr(true),
						IdempotentHint:  ptr(false),
						OpenWorldHint:   ptr(true),
					},
				},
				{
					Name:        "get-schema",
					Description: schemas.ToolGetGraphqlSchemaInstructions,
					InputSchema: mcp.ToolInputSchema{
						Type: "object",
						Properties: map[string]any{
							"role": map[string]any{
								"default":     string("user"),
								"description": string("Role to use when fetching the schema. Useful only services `local` and `project`"),
								"type":        string("string"),
							},
							"service": map[string]any{
								"enum": []any{
									string("nhost"), string("config-schema"), string("graphql-management"),
									string("project"),
								},
								"type": string("string"),
							},
							"subdomain": map[string]any{
								"description": string("Project to get the GraphQL schema for. Required when service is `project`"),
								"enum":        []any{string("local"), string("asdasdasdasdasd"), string("qweqweqweqweqwe")},
								"type":        string("string"),
							},
						},
						Required: []string{"service"},
					},
					Annotations: mcp.ToolAnnotation{
						Title:           "Get GraphQL/API schema for various services",
						ReadOnlyHint:    ptr(true),
						DestructiveHint: ptr(false),
						IdempotentHint:  ptr(true),
						OpenWorldHint:   ptr(true),
					},
				},
				{
					Name:        "graphql-query",
					Description: project.ToolGraphqlQueryInstructions,
					InputSchema: mcp.ToolInputSchema{
						Type: "object",
						Properties: map[string]any{
							"query": map[string]any{
								"description": "graphql query to perform",
								"type":        "string",
							},
							"subdomain": map[string]any{
								"description": "Project to perform the GraphQL query against",
								"type":        "string",
								"enum": []any{
									string("local"),
									string("asdasdasdasdasd"),
									string("qweqweqweqweqwe"),
								},
							},
							"role": map[string]any{
								"description": "role to use when executing queries. Default to user but make sure the user is aware. Keep in mind the schema depends on the role so if you retrieved the schema for a different role previously retrieve it for this role beforehand as it might differ",
								"type":        "string",
								"default":     "user",
							},
							"userId": map[string]any{
								"description": string("Overrides X-Hasura-User-Id in the GraphQL query/mutation. Credentials must allow it (i.e. admin secret must be in use)"),
								"type":        string("string"),
							},
							"variables": map[string]any{
								"description": "variables to use in the query",
								"type":        "string",
							},
						},
						Required: []string{"query", "subdomain"},
					},
					Annotations: mcp.ToolAnnotation{
						Title:           "Perform GraphQL Query on Nhost Project running on Nhost Cloud",
						ReadOnlyHint:    ptr(false),
						DestructiveHint: ptr(true),
						IdempotentHint:  ptr(false),
						OpenWorldHint:   ptr(true),
					},
				},
				{
					Name:        "manage-graphql",
					Description: project.ToolManageGraphqlInstructions,
					InputSchema: mcp.ToolInputSchema{
						Type: "object",
						Properties: map[string]any{
							"body": map[string]any{
								"description": "The body for the HTTP request",
								"type":        "string",
							},
							"subdomain": map[string]any{
								"description": "Project to perform the GraphQL management operation against",
								"type":        "string",
								"enum": []any{
									string("local"),
									string("asdasdasdasdasd"),
									string("qweqweqweqweqwe"),
								},
							},
						},
						Required: []string{"subdomain", "body"},
					},
					Annotations: mcp.ToolAnnotation{
						Title:           "Manage GraphQL's Metadata on an Nhost Development Project",
						ReadOnlyHint:    ptr(false),
						DestructiveHint: ptr(true),
						IdempotentHint:  ptr(true),
						OpenWorldHint:   ptr(true),
					},
				},
				{
					Name:        "search",
					Description: docs.ToolSearchInstructions,
					InputSchema: mcp.ToolInputSchema{
						Type: "object",
						Properties: map[string]any{
							"query": map[string]any{
								"description": string("The search query"),
								"type":        string("string"),
							},
						},
						Required: []string{"query"},
					},
					Annotations: mcp.ToolAnnotation{
						Title:           "Search Nhost Docs",
						ReadOnlyHint:    ptr(true),
						IdempotentHint:  ptr(true),
						DestructiveHint: ptr(false),
						OpenWorldHint:   ptr(true),
					},
				},
			},
		},
		cmpopts.SortSlices(func(a, b mcp.Tool) bool {
			return a.Name < b.Name
		}),
	); diff != "" {
		t.Errorf("ListToolsResult mismatch (-want +got):\n%s", diff)
	}

	resources, err := mcpClient.ListResources(
		context.Background(),
		mcp.ListResourcesRequest{}, //nolint:exhaustruct
	)
	if err != nil {
		t.Fatalf("failed to list resources: %v", err)
	}

	if diff := cmp.Diff(
		resources,
		//nolint:exhaustruct
		&mcp.ListResourcesResult{
			Resources: []mcp.Resource{
				{
					Annotated: mcp.Annotated{
						Annotations: &mcp.Annotations{
							Audience: []mcp.Role{"agent"},
							Priority: 9,
						},
					},
					URI:         "schema://graphql-management",
					Name:        "graphql-management",
					Description: "",
					MIMEType:    "text/plain",
				},

				{
					Annotated: mcp.Annotated{
						Annotations: &mcp.Annotations{
							Audience: []mcp.Role{"agent"},
							Priority: 9,
						},
					},
					URI:         "schema://nhost-cloud",
					Name:        "nhost-cloud",
					Description: "",
					MIMEType:    "text/plain",
				},
				{
					Annotated: mcp.Annotated{
						Annotations: &mcp.Annotations{
							Audience: []mcp.Role{"agent"},
							Priority: 9,
						},
					},
					URI:         "schema://nhost.toml",
					Name:        "nhost.toml",
					Description: "",
					MIMEType:    "text/plain",
				},
			},
		},
	); diff != "" {
		t.Errorf("ListResourcesResult mismatch (-want +got):\n%s", diff)
	}

	if res.Capabilities.Prompts != nil {
		prompts, err := mcpClient.ListPrompts(
			context.Background(),
			mcp.ListPromptsRequest{}, //nolint:exhaustruct
		)
		if err != nil {
			t.Fatalf("failed to list prompts: %v", err)
		}

		if diff := cmp.Diff(
			prompts,
			//nolint:exhaustruct
			&mcp.ListPromptsResult{
				Prompts: []mcp.Prompt{},
			},
		); diff != "" {
			t.Errorf("ListPromptsResult mismatch (-want +got):\n%s", diff)
		}
	}
}
