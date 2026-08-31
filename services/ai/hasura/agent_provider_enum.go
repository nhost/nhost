package hasura

import (
	"context"
	"errors"
	"fmt"
	"slices"
)

const agentProviderEnumTypeName = "aiAgentProviders_enum"

var errAgentProviderEnumValueNotVisible = errors.New(
	"required aiAgentProviders_enum value is not visible after metadata reload",
)

const agentProviderEnumValuesDocument = `query AgentProviderEnumValues {
	__type(name: "` + agentProviderEnumTypeName + `") {
		enumValues {
			name
		}
	}
}`

type agentProviderEnumValuesResponse struct {
	Type *agentProviderEnumType `graphql:"__type" json:"__type"`
}

type agentProviderEnumType struct {
	EnumValues []agentProviderEnumValue `graphql:"enumValues" json:"enumValues"`
}

type agentProviderEnumValue struct {
	Name string `graphql:"name" json:"name"`
}

//nolint:tagliatelle // Hasura's metadata API requires snake_case field names.
type reloadMetadataArgs struct {
	ReloadSources         []string `json:"reload_sources"`
	ReloadRemoteSchemas   bool     `json:"reload_remote_schemas"`
	RecreateEventTriggers bool     `json:"recreate_event_triggers"`
	ReloadDataConnectors  bool     `json:"reload_data_connectors"`
}

type reloadMetadataRequest struct {
	Type string             `json:"type"`
	Args reloadMetadataArgs `json:"args"`
}

// EnsureAgentProviderEnumValue guarantees that Hasura's live GraphQL schema
// exposes value in aiAgentProviders_enum.
func (c *Client) EnsureAgentProviderEnumValue(ctx context.Context, value string) error {
	values, err := c.agentProviderEnumValues(ctx)
	if err != nil {
		return fmt.Errorf("introspecting %s: %w", agentProviderEnumTypeName, err)
	}

	if slices.Contains(values, value) {
		return nil
	}

	if err := c.reloadDefaultSourceMetadata(ctx); err != nil {
		return fmt.Errorf("reloading default Hasura source metadata: %w", err)
	}

	values, err = c.agentProviderEnumValues(ctx)
	if err != nil {
		return fmt.Errorf("re-introspecting %s: %w", agentProviderEnumTypeName, err)
	}

	if !slices.Contains(values, value) {
		return fmt.Errorf("%w: %q", errAgentProviderEnumValueNotVisible, value)
	}

	return nil
}

func (c *Client) agentProviderEnumValues(ctx context.Context) ([]string, error) {
	var resp agentProviderEnumValuesResponse
	if err := c.Client.Post(
		ctx,
		"AgentProviderEnumValues",
		agentProviderEnumValuesDocument,
		&resp,
		nil,
	); err != nil {
		return nil, fmt.Errorf("querying GraphQL schema: %w", err)
	}

	if resp.Type == nil {
		return nil, nil
	}

	values := make([]string, 0, len(resp.Type.EnumValues))
	for _, enumValue := range resp.Type.EnumValues {
		values = append(values, enumValue.Name)
	}

	return values, nil
}

func (c *Client) reloadDefaultSourceMetadata(ctx context.Context) error {
	var resp any
	if err := c.QueryMetadata(ctx, &reloadMetadataRequest{
		Type: "reload_metadata",
		Args: reloadMetadataArgs{
			ReloadSources:         []string{"default"},
			ReloadRemoteSchemas:   false,
			RecreateEventTriggers: false,
			ReloadDataConnectors:  false,
		},
	}, &resp); err != nil {
		return fmt.Errorf("requesting metadata reload: %w", err)
	}

	return nil
}
