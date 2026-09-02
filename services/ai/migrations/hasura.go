package migrations

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
)

const aiSchema = "ai"

func tableAutoEmbeddingsConfiguration(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "auto_embeddings_configuration",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "aiAutoEmbeddingsConfiguration",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "aiAutoEmbeddingsConfigurations",
					SelectByPk:      "aiAutoEmbeddingsConfiguration",
					SelectAggregate: "aiAutoEmbeddingsConfigurationAggregate",
					SelectStream:    "aiAutoEmbeddingsConfigurationStream",
					Insert:          "insertAiAutoEmbeddingsConfigurations",
					InsertOne:       "insertAiAutoEmbeddingsConfiguration",
					Update:          "updateAiAutoEmbeddingsConfigurations",
					UpdateByPk:      "updateAiAutoEmbeddingsConfiguration",
					UpdateMany:      "updateManyAiAutoEmbeddingsConfigurations",
					Delete:          "deleteAiAutoEmbeddingsConfigurations",
					DeleteByPk:      "deleteAiAutoEmbeddingsConfiguration",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":          {CustomName: "id"},
					"created_at":  {CustomName: "createdAt"},
					"updated_at":  {CustomName: "updatedAt"},
					"name":        {CustomName: "name"},
					"model":       {CustomName: "model"},
					"schema_name": {CustomName: "schemaName"},
					"table_name":  {CustomName: "tableName"},
					"column_name": {CustomName: "columnName"},
					"last_run":    {CustomName: "lastRun"},
					"query":       {CustomName: "query"},
					"mutation":    {CustomName: "mutation"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track auto_embeddings_configuration table: %w", err)
	}

	return nil
}

func createEvent(
	ctx context.Context, cl *hasura.Client, table, schema, aiBaseURL, webhookEndpoint string,
) error {
	name := table
	if len(name) > 20 { //nolint:mnd
		name = name[:20]
	}

	req := &hasura.CreateEventRequest{
		Type: "pg_create_event_trigger",
		Args: hasura.CreateEventRequestArgs{
			Name: fmt.Sprintf("ai_%s_events", name),
			Table: hasura.QualifiedTable{
				Name: table, Schema: schema,
			},
			Source:  new("default"),
			Webhook: new(aiBaseURL + "/v1/webhooks/" + webhookEndpoint),
			Insert:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Update:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Delete:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Headers: []hasura.Header{
				{ //nolint:exhaustruct
					Name:         "X-AI-Webhook-Secret",
					ValueFromEnv: "AI_WEBHOOK_SECRET",
				},
			},
			RetryConf: &hasura.RetryConf{
				NumRetries:  3,  //nolint:mnd
				IntervalSec: 30, //nolint:mnd
				TimeoutSec:  30, //nolint:mnd
			},
			CleanupConfig: &hasura.AutoEventTriggerCleanupConfig{
				Schedule:            "0 0 * * *",
				BatchSize:           10000, //nolint:mnd
				ClearOlderThan:      168,   //nolint:mnd
				Timeout:             60,    //nolint:mnd
				CleanInvocationLogs: true,
				Paused:              false,
			},
			Replace: new(true),
		},
	}

	retryWithCreate := false

	if err := cl.CreateEvent(ctx, req); err != nil {
		var reqErr *hasura.MetadataRequestError
		if errors.As(err, &reqErr) && reqErr.Body.Code == hasura.ErrorCodeNotExists {
			retryWithCreate = true
		} else {
			return fmt.Errorf("failed to update event: %w", err)
		}
	}

	if retryWithCreate {
		req.Args.Replace = new(false)
		if err := cl.CreateEvent(ctx, req); err != nil {
			return fmt.Errorf("failed to create event: %w", err)
		}
	}

	return nil
}

func tableAgentProviders(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackEnumTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackEnumTableArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "agent_providers",
			},
			IsEnum: true,
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "aiAgentProviders",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "aiAgentProviders",
					SelectByPk:      "aiAgentProvider",
					SelectAggregate: "aiAgentProviderAggregate",
					SelectStream:    "aiAgentProviderStream",
					Insert:          "insertAiAgentProviders",
					InsertOne:       "insertAiAgentProvider",
					Update:          "updateAiAgentProviders",
					UpdateByPk:      "updateAiAgentProvider",
					UpdateMany:      "updateManyAiAgentProviders",
					Delete:          "deleteAiAgentProviders",
					DeleteByPk:      "deleteAiAgentProvider",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"value":   {CustomName: "value"},
					"comment": {CustomName: "comment"},
				},
			},
		},
	}

	if err := cl.TrackEnumTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track agent_providers table: %w", err)
	}

	return nil
}

func tableAgents(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "agents",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "aiAgents",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "aiAgents",
					SelectByPk:      "aiAgent",
					SelectAggregate: "aiAgentAggregate",
					SelectStream:    "aiAgentStream",
					Insert:          "insertAiAgents",
					InsertOne:       "insertAiAgent",
					Update:          "updateAiAgents",
					UpdateByPk:      "updateAiAgent",
					UpdateMany:      "updateManyAiAgents",
					Delete:          "deleteAiAgents",
					DeleteByPk:      "deleteAiAgent",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":           {CustomName: "id"},
					"created_at":   {CustomName: "createdAt"},
					"updated_at":   {CustomName: "updatedAt"},
					"user_id":      {CustomName: "userID"},
					"name":         {CustomName: "name"},
					"description":  {CustomName: "description"},
					"instructions": {CustomName: "instructions"},
					"provider":     {CustomName: "provider"},
					"model":        {CustomName: "model"},
					"tools_config": {CustomName: "toolsConfig"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track agents table: %w", err)
	}

	return nil
}

func tableAgentSessions(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "agent_sessions",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "aiAgentSessions",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "aiAgentSessions",
					SelectByPk:      "aiAgentSession",
					SelectAggregate: "aiAgentSessionAggregate",
					SelectStream:    "aiAgentSessionStream",
					Insert:          "insertAiAgentSessions",
					InsertOne:       "insertAiAgentSession",
					Update:          "updateAiAgentSessions",
					UpdateByPk:      "updateAiAgentSession",
					UpdateMany:      "updateManyAiAgentSessions",
					Delete:          "deleteAiAgentSessions",
					DeleteByPk:      "deleteAiAgentSession",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":         {CustomName: "id"},
					"created_at": {CustomName: "createdAt"},
					"updated_at": {CustomName: "updatedAt"},
					"agent_id":   {CustomName: "agentID"},
					"user_id":    {CustomName: "userID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track agent_sessions table: %w", err)
	}

	return nil
}

func agentSessionsRelationships(ctx context.Context, cl *hasura.Client) error {
	agentSessionsTable := hasura.TrackTableRequestArgsTable{
		Schema: aiSchema,
		Name:   "agent_sessions",
	}

	agent := &hasura.CreateRelationshipRequest{
		Type: "pg_create_object_relationship",
		Args: hasura.CreateRelationshipArgs{
			Table:  agentSessionsTable,
			Name:   "agent",
			Source: "default",
			Using: hasura.RelationshipUsing{
				ForeignKeyConstraintOn: "agent_id",
			},
		},
	}

	if err := cl.CreateRelationship(ctx, agent); err != nil {
		return fmt.Errorf("failed to create agent relationship: %w", err)
	}

	user := &hasura.CreateRelationshipRequest{
		Type: "pg_create_object_relationship",
		Args: hasura.CreateRelationshipArgs{
			Table:  agentSessionsTable,
			Name:   "user",
			Source: "default",
			Using: hasura.RelationshipUsing{
				ForeignKeyConstraintOn: "user_id",
			},
		},
	}

	if err := cl.CreateRelationship(ctx, user); err != nil {
		return fmt.Errorf("failed to create user relationship: %w", err)
	}

	agentMessages := &hasura.CreateRelationshipRequest{
		Type: "pg_create_array_relationship",
		Args: hasura.CreateRelationshipArgs{
			Table:  agentSessionsTable,
			Name:   "agentMessages",
			Source: "default",
			Using: hasura.RelationshipUsing{
				ForeignKeyConstraintOn: hasura.ArrayRelationshipForeignKey{
					Table: hasura.TrackTableRequestArgsTable{
						Schema: aiSchema,
						Name:   "agent_messages",
					},
					Column: "session_id",
				},
			},
		},
	}

	if err := cl.CreateRelationship(ctx, agentMessages); err != nil {
		return fmt.Errorf("failed to create agentMessages relationship: %w", err)
	}

	return nil
}

func tableAgentMessages(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "agent_messages",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "aiAgentMessages",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "aiAgentMessages",
					SelectByPk:      "aiAgentMessage",
					SelectAggregate: "aiAgentMessageAggregate",
					SelectStream:    "aiAgentMessageStream",
					Insert:          "insertAiAgentMessages",
					InsertOne:       "insertAiAgentMessage",
					Update:          "updateAiAgentMessages",
					UpdateByPk:      "updateAiAgentMessage",
					UpdateMany:      "updateManyAiAgentMessages",
					Delete:          "deleteAiAgentMessages",
					DeleteByPk:      "deleteAiAgentMessage",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":           {CustomName: "id"},
					"seq":          {CustomName: "seq"},
					"created_at":   {CustomName: "createdAt"},
					"session_id":   {CustomName: "sessionID"},
					"role":         {CustomName: "role"},
					"content":      {CustomName: "content"},
					"tool_calls":   {CustomName: "toolCalls"},
					"tool_call_id": {CustomName: "toolCallID"},
					"tool_name":    {CustomName: "toolName"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track agent_messages table: %w", err)
	}

	return nil
}

func agentMessagesRelationships(ctx context.Context, cl *hasura.Client) error {
	agentSession := &hasura.CreateRelationshipRequest{
		Type: "pg_create_object_relationship",
		Args: hasura.CreateRelationshipArgs{
			Table: hasura.TrackTableRequestArgsTable{
				Schema: aiSchema,
				Name:   "agent_messages",
			},
			Name:   "agentSession",
			Source: "default",
			Using: hasura.RelationshipUsing{
				ForeignKeyConstraintOn: "session_id",
			},
		},
	}

	if err := cl.CreateRelationship(ctx, agentSession); err != nil {
		return fmt.Errorf("failed to create agentSession relationship: %w", err)
	}

	return nil
}

func ApplyHasuraMetadata(
	ctx context.Context, cl *hasura.Client, aiBaseURL string, logger *slog.Logger,
) error {
	steps := []struct {
		name string
		fn   func() error
	}{
		{
			"auto-embeddings table",
			func() error { return tableAutoEmbeddingsConfiguration(ctx, cl) },
		},
		{"agent providers table", func() error { return tableAgentProviders(ctx, cl) }},
		{"agents table", func() error { return tableAgents(ctx, cl) }},
		{"agent sessions table", func() error { return tableAgentSessions(ctx, cl) }},
		{"agent messages table", func() error { return tableAgentMessages(ctx, cl) }},
		{
			"agent sessions relationships",
			func() error { return agentSessionsRelationships(ctx, cl) },
		},
		{
			"agent messages relationships",
			func() error { return agentMessagesRelationships(ctx, cl) },
		},
		{"auto-embeddings event", func() error {
			return createEvent(
				ctx, cl, "auto_embeddings_configuration",
				aiSchema, aiBaseURL, "auto-embeddings-configuration",
			)
		}},
	}

	for _, step := range steps {
		logger.InfoContext(ctx, "applying metadata for "+step.name)

		if err := step.fn(); err != nil {
			return fmt.Errorf("failed to apply metadata for %s: %w", step.name, err)
		}
	}

	return nil
}
