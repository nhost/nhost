package openai

import (
	"context"
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/openai/api"
)

func assistantObject2Assistant(obj api.AssistantObject) (*model.GraphiteAssistant, error) {
	graphql := make([]*model.GraphiteAssistantToolGraphQl, 0, len(obj.Tools))

	webhooks := make([]*model.GraphiteAssistantToolWebhook, 0, len(obj.Tools))
	for k, v := range *obj.Metadata {
		if strings.HasPrefix(k, "graphql-") && v != "" {
			gql, err := toolFromMetadata[model.GraphiteAssistantToolGraphQl](v)
			if err != nil {
				return nil, err
			}

			graphql = append(graphql, gql)
		} else if strings.HasPrefix(k, "webhook-") && v != "" {
			wh, err := toolFromMetadata[model.GraphiteAssistantToolWebhook](v)
			if err != nil {
				return nil, err
			}

			webhooks = append(webhooks, wh)
		}
	}

	return &model.GraphiteAssistant{ //nolint:exhaustruct
		AssistantID:  obj.Id,
		Name:         *obj.Name,
		Description:  *obj.Description,
		Instructions: *obj.Instructions,
		Model:        obj.Model,
		Graphql:      graphql,
		Webhooks:     webhooks,
	}, nil
}

func (cl *Client) AssistantsGetOld(
	ctx context.Context,
	id string,
) (*model.GraphiteAssistant, error) {
	resp, err := cl.oai.GetAssistantWithResponse(
		ctx,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("error listing assistants: %w", err)
	}

	if err := handleReponseStatus(resp, resp.Body); err != nil {
		return nil, err
	}

	if resp.JSON200.Metadata == nil || (*resp.JSON200.Metadata)["managed-by"] != managedBy {
		return nil, ErrNotfound
	}

	assistant, err := assistantObject2Assistant(*resp.JSON200)
	if err != nil {
		return nil, fmt.Errorf("error converting assistant: %w", err)
	}

	return assistant, nil
}
