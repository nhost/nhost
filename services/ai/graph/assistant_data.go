package graph

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/nhost/nhost/services/ai/graph/model"
	"github.com/nhost/nhost/services/ai/hasura"
)

func isEmptyData(data json.RawMessage) bool {
	return len(data) == 0 || bytes.Equal(bytes.TrimSpace(data), []byte("null"))
}

func firstAssistantData(
	assistants []*hasura.GetAssistants_GraphiteAssistants,
) (json.RawMessage, error) {
	if len(assistants) == 0 || assistants[0] == nil {
		return nil, ErrAssistantNotFound
	}

	return assistants[0].Data, nil
}

func decodeAssistantData(data json.RawMessage) (*model.GraphiteAssistant, error) {
	if isEmptyData(data) {
		return nil, ErrAssistantNotFound
	}

	var assistant *model.GraphiteAssistant
	if err := json.Unmarshal(data, &assistant); err != nil {
		return nil, fmt.Errorf("error unmarshalling assistant: %w", err)
	}

	if assistant == nil {
		return nil, ErrAssistantNotFound
	}

	return assistant, nil
}
