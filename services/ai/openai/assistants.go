package openai

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai/api"
)

const managedBy = "graphite"

func (cl *Client) assistantsList(ctx context.Context) ([]api.AssistantObject, error) {
	resp, err := cl.oai.ListAssistantsWithResponse(
		ctx,
		&api.ListAssistantsParams{
			Limit:  new(maxListElements),
			Order:  new(api.ListAssistantsParamsOrderAsc),
			After:  nil,
			Before: nil,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error listing assistants: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	return resp.JSON200.Data, nil
}

func (cl *Client) AssistantsCreate( //nolint:funlen
	ctx context.Context, id string, input model.GraphiteAssistantInput,
) (string, error) {
	metadata := map[string]any{
		"managed-by":  managedBy,
		"database-id": id,
	}

	m := api.CreateAssistantRequest_Model{}
	if err := m.FromCreateAssistantRequestModel0(input.Model); err != nil {
		return "", fmt.Errorf("error converting model: %w", err)
	}

	tools := make(
		[]api.CreateAssistantRequest_Tools_Item,
		0, len(input.Graphql)+len(input.Webhooks)+1,
	)

	for _, gql := range input.Graphql {
		t := api.CreateAssistantRequest_Tools_Item{}
		if err := ToToolsItem(gql, GraphqlQueryToFunctionsObject, &t); err != nil {
			return "", fmt.Errorf("error converting graphql: %w", err)
		}

		tools = append(tools, t)
	}

	for _, wh := range input.Webhooks {
		t := api.CreateAssistantRequest_Tools_Item{}
		if err := ToToolsItem(wh, WebhookToFunctionsObject, &t); err != nil {
			return "", fmt.Errorf("error converting webhook: %w", err)
		}

		tools = append(tools, t)
	}

	if len(input.FileStores) > 0 {
		// we only enable this tool if there are file stores
		// because some models don't support it, i.e., o1
		tool := api.CreateAssistantRequest_Tools_Item{}
		if err := tool.MergeAssistantToolsFileSearch(
			api.AssistantToolsFileSearch{Type: "file_search"}, //nolint: exhaustruct
		); err != nil {
			return "", fmt.Errorf("error merging assistant tools: %w", err)
		}

		tools = append(tools, tool)
	}

	reqBody := api.CreateAssistantJSONRequestBody{
		Description:    &input.Description,
		Instructions:   &input.Instructions,
		Metadata:       &metadata,
		Model:          m,
		Name:           &input.Name,
		ResponseFormat: nil,
		Temperature:    nil,
		TopP:           nil,
		ToolResources: &struct { //nolint:exhaustruct
			CodeInterpreter *struct {
				FileIds *[]string "json:\"file_ids,omitempty\"" //nolint:revive,tagalign
			} "json:\"code_interpreter,omitempty\"" //nolint:tagalign
			FileSearch *api.CreateAssistantRequest_ToolResources_FileSearch "json:\"file_search,omitempty\"" //nolint:tagalign
		}{},
		Tools: &tools,
	}

	resp, err := cl.oai.CreateAssistantWithResponse(ctx, reqBody)
	if err != nil {
		return "", fmt.Errorf("error creating assistant: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return "", err
	}

	return resp.JSON200.Id, nil
}

func (cl *Client) AssistantsUpdate( //nolint:funlen
	ctx context.Context, id string, input model.GraphiteAssistantInput,
) error {
	metadata := map[string]any{
		"managed-by":  managedBy,
		"database-id": id,
	}

	m := api.ModifyAssistantRequest_Model{}
	if err := m.FromModifyAssistantRequestModel0(input.Model); err != nil {
		return fmt.Errorf("error converting model: %w", err)
	}

	tools := make(
		[]api.ModifyAssistantRequest_Tools_Item,
		0, len(input.Graphql)+len(input.Webhooks)+1,
	)

	for _, gql := range input.Graphql {
		t := api.ModifyAssistantRequest_Tools_Item{}
		if err := ToToolsItem(gql, GraphqlQueryToFunctionsObject, &t); err != nil {
			return fmt.Errorf("error converting graphql: %w", err)
		}

		tools = append(tools, t)
	}

	for _, wh := range input.Webhooks {
		t := api.ModifyAssistantRequest_Tools_Item{}
		if err := ToToolsItem(wh, WebhookToFunctionsObject, &t); err != nil {
			return fmt.Errorf("error converting webhook: %w", err)
		}

		tools = append(tools, t)
	}

	if len(input.FileStores) > 0 {
		// we only enable this tool if there are file stores
		// because some models don't support it, i.e., o1
		tool := api.ModifyAssistantRequest_Tools_Item{}
		if err := tool.MergeAssistantToolsFileSearch(
			api.AssistantToolsFileSearch{Type: "file_search"}, //nolint: exhaustruct
		); err != nil {
			return fmt.Errorf("error merging assistant tools: %w", err)
		}

		tools = append(tools, tool)
	}

	reqBody := api.ModifyAssistantJSONRequestBody{
		Name:           &input.Name,
		Description:    &input.Description,
		Instructions:   &input.Instructions,
		Metadata:       &metadata,
		Model:          &m,
		ResponseFormat: nil,
		Temperature:    nil,
		TopP:           nil,
		Tools:          &tools,
		ToolResources: &struct { //nolint:exhaustruct
			CodeInterpreter *struct {
				FileIds *[]string "json:\"file_ids,omitempty\"" //nolint:revive,tagalign
			} "json:\"code_interpreter,omitempty\"" //nolint:tagalign
			FileSearch *struct {
				VectorStoreIds *[]string "json:\"vector_store_ids,omitempty\"" //nolint:revive,tagalign
			} "json:\"file_search,omitempty\"" //nolint:tagalign
		}{},
	}

	resp, err := cl.oai.ModifyAssistantWithResponse(ctx, id, reqBody)
	if err != nil {
		return fmt.Errorf("error updating assistant: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return err
	}

	return nil
}

func (cl *Client) AssistantsDelete(
	ctx context.Context, id string,
) error {
	resp, err := cl.oai.DeleteAssistantWithResponse(
		ctx,
		id,
	)
	if err != nil {
		return fmt.Errorf("error deleting assistant: %w", err)
	}

	return handleReponseStatus(resp, resp.Body)
}
