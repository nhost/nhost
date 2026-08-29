package openai

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai/api"
)

const (
	devAssistantName        = "nhost-dashboard-dev-assistant"
	devAssistantDescription = "This assistant is used by the Nhost Dashboard"
	//nolint:lll
	devAssistantInstructions = `You are a useful assistant helping Nhost users build better apps. The user's database is postgres and they use hasura to provide a graphql API on top of it.

Before responding to any questions related to how to query, insert or update data, or how to do things relating to sql, postgres or graphql ALWAYS use the tools list_sql_tables and get_graphql_schema_layout to know what's available and then immediately use get_sql_schema or get_graphql_schema_method to get more details about the operation involved`
)

func (cl *Client) getDevAssistantTools() ([]api.CreateAssistantRequest_Tools_Item, error) { //nolint:funlen
	pgTables := api.CreateAssistantRequest_Tools_Item{}
	if err := pgTables.FromAssistantToolsFunction(api.AssistantToolsFunction{
		Type: "function",
		Function: api.FunctionObject{ //nolint:exhaustruct
			Name:        "list_sql_tables",
			Description: new("List all tables in the postgres database"),
			Parameters: &api.FunctionParameters{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
	}); err != nil {
		return nil, fmt.Errorf("error converting postgres tool: %w", err)
	}

	pgSchema := api.CreateAssistantRequest_Tools_Item{}
	if err := pgSchema.FromAssistantToolsFunction(api.AssistantToolsFunction{
		Type: "function",
		Function: api.FunctionObject{ //nolint:exhaustruct
			Name:        "get_sql_schema",
			Description: new("Get SQL schema for postgres database"),
			Parameters: &api.FunctionParameters{
				"type": "object",
				"properties": map[string]any{
					"schema": map[string]any{
						"type":        "string",
						"description": "The database schema",
					},
					"table": map[string]any{
						"type":        "string",
						"description": "The database table",
					},
				},
				"required": []string{"schema", "table"},
			},
		},
	}); err != nil {
		return nil, fmt.Errorf("error converting postgres tool: %w", err)
	}

	graphqlSchemaLayout := api.CreateAssistantRequest_Tools_Item{}
	if err := graphqlSchemaLayout.FromAssistantToolsFunction(api.AssistantToolsFunction{
		Type: "function",
		Function: api.FunctionObject{ //nolint:exhaustruct
			Name: "get_graphql_schema_layout",

			Description: new(
				"Get graphql schema layout for the project. Returns all queries, mutations and subscriptions available.",
			),
			Parameters: &api.FunctionParameters{
				"type":       "object",
				"properties": map[string]any{},
				"required":   []string{},
			},
		},
	}); err != nil {
		return nil, fmt.Errorf("error converting postgres tool: %w", err)
	}

	graphqlSchemaMethod := api.CreateAssistantRequest_Tools_Item{}
	if err := graphqlSchemaMethod.FromAssistantToolsFunction(api.AssistantToolsFunction{
		Type: "function",
		Function: api.FunctionObject{ //nolint:exhaustruct
			Name: "get_graphql_schema_method",

			Description: new(
				"Given an operation and method name return the details about the method and all of its associated objects.",
			),
			Parameters: &api.FunctionParameters{
				"type": "object",
				"properties": map[string]any{
					"operation": map[string]any{
						"type":        "string",
						"description": "The operation type, one of; query, mutation, subscription",
					},
					"method": map[string]any{
						"type":        "string",
						"description": "The method name you want to get details about",
					},
				},
				"required": []string{},
			},
		},
	}); err != nil {
		return nil, fmt.Errorf("error converting postgres tool: %w", err)
	}

	return []api.CreateAssistantRequest_Tools_Item{
		pgTables, pgSchema, graphqlSchemaLayout, graphqlSchemaMethod,
	}, nil
}

func getDevAssistant(id string) *model.GraphiteAssistant {
	return &model.GraphiteAssistant{ //nolint:exhaustruct
		AssistantID:  id,
		Name:         devAssistantName,
		Description:  devAssistantDescription,
		Instructions: devAssistantInstructions,
		Model:        "gpt-3.5-turbo-1106",
		Graphql:      nil,
		Webhooks:     nil,
	}
}

func (cl *Client) FindOrCreateDevAssistant(
	ctx context.Context,
) (*model.GraphiteAssistant, error) {
	assListR, err := cl.assistantsList(ctx)
	if err != nil {
		return nil, err
	}

	for _, a := range assListR {
		if a.Name != nil && *a.Name == devAssistantName {
			return getDevAssistant(a.Id), nil
		}
	}

	metadata := map[string]any{
		"managed-by": "graphite",
		"used-by":    "nhost-dashboard",
	}

	m := api.CreateAssistantRequest_Model{}
	if err := m.FromCreateAssistantRequestModel0("gpt-3.5-turbo-1106"); err != nil {
		return nil, fmt.Errorf("error converting model: %w", err)
	}

	tools, err := cl.getDevAssistantTools()
	if err != nil {
		return nil, err
	}

	reqBody := api.CreateAssistantJSONRequestBody{ //nolint:exhaustruct
		Name:         new(devAssistantName),
		Description:  new(devAssistantDescription),
		Instructions: new(devAssistantInstructions),
		Metadata:     &metadata,
		Model:        m,
		Tools:        &tools,
		ToolResources: &struct { //nolint:exhaustruct
			CodeInterpreter *struct {
				FileIds *[]string "json:\"file_ids,omitempty\"" //nolint:revive,tagalign
			} "json:\"code_interpreter,omitempty\"" //nolint:tagalign
			FileSearch *api.CreateAssistantRequest_ToolResources_FileSearch "json:\"file_search,omitempty\"" //nolint:tagalign
		}{},
	}

	resp, err := cl.oai.CreateAssistantWithResponse(ctx, reqBody)
	if err != nil {
		return nil, fmt.Errorf("error creating assistant: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return getDevAssistant(resp.JSON200.Id), nil
}
