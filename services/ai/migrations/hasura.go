package migrations

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/nhost/nhost/services/ai/hasura"
)

const graphiteSchema = "graphite"

func AddRemoteSchema(ctx context.Context, cl *hasura.Client, graphiteBaseURL string) error {
	// we attempt to reload the remote schema first to fix any potential inconsistencies
	_ = cl.ReloadRemoteSchema(ctx, "graphite")

	req := &hasura.RemoteSchemaRequest{
		Type: "add_remote_schema",
		Args: hasura.RemoteSchemaRequestArgs{
			Name:    graphiteSchema,
			Comment: "Nhost Graphite remote schema",
			Definition: hasura.RemoteSchemaRequestArgsDefinition{
				URL: graphiteBaseURL + "/v1/graphql",
				Headers: []hasura.Headers{
					{ //nolint:exhaustruct
						Name:         "X-Graphite-Webhook-Secret",
						ValueFromEnv: "GRAPHITE_WEBHOOK_SECRET",
					},
				},
				ForwardClientHeaders: true,
				TimeoutSeconds:       300, //nolint:mnd
				Customization: hasura.Customization{
					RootFieldsNamespace: "graphite",
					TypeNames: hasura.TypeNames{
						Prefix:  "",
						Suffix:  "",
						Mapping: map[string]string{},
					},
					FieldNames: []hasura.FieldNames{},
				},
			},
		},
	}
	if err := cl.RemoteSchema(ctx, req); err != nil {
		var reqErr *hasura.MetadataRequestError
		if errors.As(err, &reqErr) && reqErr.Body.Code == hasura.ErrorCodeAlreadyExists {
			req.Type = "update_remote_schema"
			if err := cl.RemoteSchema(ctx, req); err != nil {
				return fmt.Errorf("failed to update remote schema: %w", err)
			}
		} else {
			return fmt.Errorf("failed to add remote schema: %w", err)
		}
	}

	if err := cl.ReloadRemoteSchema(ctx, "graphite"); err != nil {
		return fmt.Errorf("failed to reload remote schema: %w", err)
	}

	return nil
}

func tableAutoEmbeddingsConfiguration(ctx context.Context, cl *hasura.Client) error {
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "auto_embeddings_configuration",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "graphiteAutoEmbeddingsConfiguration",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "graphiteAutoEmbeddingsConfigurations",
					SelectByPk:      "graphiteAutoEmbeddingsConfiguration",
					SelectAggregate: "graphiteAutoEmbeddingsConfigurationAggregate",
					SelectStream:    "graphiteAutoEmbeddingsConfigurationStream",
					Insert:          "insertGraphiteAutoEmbeddingsConfigurations",
					InsertOne:       "insertGraphiteAutoEmbeddingsConfiguration",
					Update:          "updateGraphiteAutoEmbeddingsConfigurations",
					UpdateByPk:      "updateGraphiteAutoEmbeddingsConfiguration",
					UpdateMany:      "updateManyGraphiteAutoEmbeddingsConfigurations",
					Delete:          "deleteGraphiteAutoEmbeddingsConfigurations",
					DeleteByPk:      "deleteGraphiteAutoEmbeddingsConfiguration",
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

func tableSessions(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "sessions",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteSessions",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteSessions",
					SelectByPk:      "_graphiteSession",
					SelectAggregate: "_graphiteSessionAggregate",
					SelectStream:    "_graphiteSessionStream",
					Insert:          "_insertGraphiteSessions",
					InsertOne:       "_insertGraphiteSession",
					Update:          "_updateGraphiteSessions",
					UpdateByPk:      "_updateGraphiteSession",
					UpdateMany:      "_updateManyGraphiteSessions",
					Delete:          "_deleteGraphiteSessions",
					DeleteByPk:      "_deleteGraphiteSession",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":           {CustomName: "id"},
					"session_id":   {CustomName: "sessionID"},
					"created_at":   {CustomName: "createdAt"},
					"updated_at":   {CustomName: "updatedAt"},
					"user_id":      {CustomName: "userID"},
					"assistant_id": {CustomName: "assistantID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track sessions table: %w", err)
	}

	return nil
}

func tableAssistants(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "assistants",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteAssistants",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteAssistants",
					SelectByPk:      "_graphiteAssistant",
					SelectAggregate: "_graphiteAssistantAggregate",
					SelectStream:    "_graphiteAssistantStream",
					Insert:          "_insertGraphiteAssistants",
					InsertOne:       "_insertGraphiteAssistant",
					Update:          "_updateGraphiteAssistants",
					UpdateByPk:      "_updateGraphiteAssistant",
					UpdateMany:      "_updateManyGraphiteAssistants",
					Delete:          "_deleteGraphiteAssistants",
					DeleteByPk:      "_deleteGraphiteAssistant",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":           {CustomName: "id"},
					"created_at":   {CustomName: "createdAt"},
					"updated_at":   {CustomName: "updatedAt"},
					"assistant_id": {CustomName: "assistantID"},
					"data":         {CustomName: "data"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track assistants table: %w", err)
	}

	return nil
}

func tableFiles(ctx context.Context, cl *hasura.Client) error { //nolint: dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "files",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteFiles",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteFiles",
					SelectByPk:      "_graphiteFile",
					SelectAggregate: "_graphiteFileAggregate",
					SelectStream:    "_graphiteFileStream",
					Insert:          "_insertGraphiteFiles",
					InsertOne:       "_insertGraphiteFile",
					Update:          "_updateGraphiteFiles",
					UpdateByPk:      "_updateGraphiteFile",
					UpdateMany:      "_updateManyGraphiteFiles",
					Delete:          "_deleteGraphiteFiles",
					DeleteByPk:      "_deleteGraphiteFile",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":              {CustomName: "id"},
					"created_at":      {CustomName: "createdAt"},
					"updated_at":      {CustomName: "updatedAt"},
					"file_id":         {CustomName: "fileID"},
					"storage_file_id": {CustomName: "storageFileID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track files table: %w", err)
	}

	return nil
}

func tableFileStores(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "file_stores",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteFileStores",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteFileStores",
					SelectByPk:      "_graphiteFileStore",
					SelectAggregate: "_graphiteFileStoreAggregate",
					SelectStream:    "_graphiteFileStoreStream",
					Insert:          "_insertGraphiteFileStores",
					InsertOne:       "_insertGraphiteFileStore",
					Update:          "_updateGraphiteFileStores",
					UpdateByPk:      "_updateGraphiteFileStore",
					UpdateMany:      "_updateManyGraphiteFileStores",
					Delete:          "_deleteGraphiteFileStores",
					DeleteByPk:      "_deleteGraphiteFileStore",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"id":              {CustomName: "id"},
					"created_at":      {CustomName: "createdAt"},
					"updated_at":      {CustomName: "updatedAt"},
					"last_synced_at":  {CustomName: "lastSyncedAt"},
					"vector_store_id": {CustomName: "vectorStoreID"},
					"user_id":         {CustomName: "userID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track file_stores table: %w", err)
	}

	return nil
}

func tableAssistantFileStores(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "assistant_file_stores",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteAssistantFileStores",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteAssistantFileStores",
					SelectByPk:      "_graphiteAssistantFileStore",
					SelectAggregate: "_graphiteAssistantFileStoreAggregate",
					SelectStream:    "_graphiteAssistantFileStoreStream",
					Insert:          "_insertGraphiteAssistantFileStores",
					InsertOne:       "_insertGraphiteAssistantFileStore",
					Update:          "_updateGraphiteAssistantFileStores",
					UpdateByPk:      "_updateGraphiteAssistantFileStore",
					UpdateMany:      "_updateManyGraphiteAssistantFileStores",
					Delete:          "_deleteGraphiteAssistantFileStores",
					DeleteByPk:      "_deleteGraphiteAssistantFileStore",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"created_at":    {CustomName: "createdAt"},
					"updated_at":    {CustomName: "updatedAt"},
					"assistant_id":  {CustomName: "assistantID"},
					"file_store_id": {CustomName: "fileStoreID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track assistant_file_stores table: %w", err)
	}

	return nil
}

func tableFileStoreBuckets(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "file_store_buckets",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "_graphiteFileStoreBuckets",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "_graphiteFileStoreBuckets",
					SelectByPk:      "_graphiteFileStoreBucket",
					SelectAggregate: "_graphiteFileStoreBucketAggregate",
					SelectStream:    "_graphiteFileStoreBucketStream",
					Insert:          "_insertGraphiteFileStoreBuckets",
					InsertOne:       "_insertGraphiteFileStoreBucket",
					Update:          "_updateGraphiteFileStoreBuckets",
					UpdateByPk:      "_updateGraphiteFileStoreBucket",
					UpdateMany:      "_updateManyGraphiteFileStoreBuckets",
					Delete:          "_deleteGraphiteFileStoreBuckets",
					DeleteByPk:      "_deleteGraphiteFileStoreBucket",
				},
				ColumnConfig: map[string]hasura.TrackTableRequestArgsConfigurationColumnConfig{
					"created_at":    {CustomName: "createdAt"},
					"updated_at":    {CustomName: "updatedAt"},
					"file_store_id": {CustomName: "fileStoreID"},
					"bucket_id":     {CustomName: "bucketID"},
				},
			},
		},
	}

	if err := cl.TrackTable(ctx, table); err != nil {
		return fmt.Errorf("failed to track file_store_buckets table: %w", err)
	}

	return nil
}

func createEvent(
	ctx context.Context, cl *hasura.Client, table, schema, graphiteBaseURL, webhookEndpoint string,
) error {
	name := table
	if len(name) > 20 { //nolint:mnd
		name = name[:20]
	}

	req := &hasura.CreateEventRequest{
		Type: "pg_create_event_trigger",
		Args: hasura.CreateEventRequestArgs{
			Name: fmt.Sprintf("graphite_%s_events", name),
			Table: hasura.QualifiedTable{
				Name: table, Schema: schema,
			},
			Source:  new("default"),
			Webhook: new(graphiteBaseURL + "/v1/webhooks/" + webhookEndpoint),
			Insert:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Update:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Delete:  &hasura.OperationSpec{Columns: "*", Payload: "*"},
			Headers: []hasura.Header{
				{ //nolint:exhaustruct
					Name:         "X-Graphite-Webhook-Secret",
					ValueFromEnv: "GRAPHITE_WEBHOOK_SECRET",
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
				Schema: graphiteSchema,
				Name:   "agent_providers",
			},
			IsEnum: true,
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "graphiteAgentProviders",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "graphiteAgentProviders",
					SelectByPk:      "graphiteAgentProvider",
					SelectAggregate: "graphiteAgentProviderAggregate",
					SelectStream:    "graphiteAgentProviderStream",
					Insert:          "insertGraphiteAgentProviders",
					InsertOne:       "insertGraphiteAgentProvider",
					Update:          "updateGraphiteAgentProviders",
					UpdateByPk:      "updateGraphiteAgentProvider",
					UpdateMany:      "updateManyGraphiteAgentProviders",
					Delete:          "deleteGraphiteAgentProviders",
					DeleteByPk:      "deleteGraphiteAgentProvider",
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
				Schema: graphiteSchema,
				Name:   "agents",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "graphiteAgents",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "graphiteAgents",
					SelectByPk:      "graphiteAgent",
					SelectAggregate: "graphiteAgentAggregate",
					SelectStream:    "graphiteAgentStream",
					Insert:          "insertGraphiteAgents",
					InsertOne:       "insertGraphiteAgent",
					Update:          "updateGraphiteAgents",
					UpdateByPk:      "updateGraphiteAgent",
					UpdateMany:      "updateManyGraphiteAgents",
					Delete:          "deleteGraphiteAgents",
					DeleteByPk:      "deleteGraphiteAgent",
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

func tableAgentSessions(ctx context.Context, cl *hasura.Client) error { //nolint:dupl
	table := &hasura.TrackTableRequest{
		Type: "pg_track_table",
		Args: hasura.TrackTableRequestArgs{
			Source: "default",
			Table: hasura.TrackTableRequestArgsTable{
				Schema: graphiteSchema,
				Name:   "agent_sessions",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "graphiteAgentSessions",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "graphiteAgentSessions",
					SelectByPk:      "graphiteAgentSession",
					SelectAggregate: "graphiteAgentSessionAggregate",
					SelectStream:    "graphiteAgentSessionStream",
					Insert:          "insertGraphiteAgentSessions",
					InsertOne:       "insertGraphiteAgentSession",
					Update:          "updateGraphiteAgentSessions",
					UpdateByPk:      "updateGraphiteAgentSession",
					UpdateMany:      "updateManyGraphiteAgentSessions",
					Delete:          "deleteGraphiteAgentSessions",
					DeleteByPk:      "deleteGraphiteAgentSession",
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
		Schema: graphiteSchema,
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
						Schema: graphiteSchema,
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
				Schema: graphiteSchema,
				Name:   "agent_messages",
			},
			Configuration: hasura.TrackTableRequestArgsConfiguration{
				CustomName: "graphiteAgentMessages",
				CustomRootFields: hasura.TrackTableRequestArgsConfigurationCustomRootFields{
					Select:          "graphiteAgentMessages",
					SelectByPk:      "graphiteAgentMessage",
					SelectAggregate: "graphiteAgentMessageAggregate",
					SelectStream:    "graphiteAgentMessageStream",
					Insert:          "insertGraphiteAgentMessages",
					InsertOne:       "insertGraphiteAgentMessage",
					Update:          "updateGraphiteAgentMessages",
					UpdateByPk:      "updateGraphiteAgentMessage",
					UpdateMany:      "updateManyGraphiteAgentMessages",
					Delete:          "deleteGraphiteAgentMessages",
					DeleteByPk:      "deleteGraphiteAgentMessage",
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
				Schema: graphiteSchema,
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
	ctx context.Context, cl *hasura.Client, graphiteBaseURL string, logger *slog.Logger,
) error {
	// we attempt to reload the remote schema first to fix any potential inconsistencies
	_ = cl.ReloadRemoteSchema(ctx, "graphite")

	steps := []struct {
		name string
		fn   func() error
	}{
		{
			"auto-embeddings table",
			func() error { return tableAutoEmbeddingsConfiguration(ctx, cl) },
		},
		{"sessions table", func() error { return tableSessions(ctx, cl) }},
		{"assistants table", func() error { return tableAssistants(ctx, cl) }},
		{"files table", func() error { return tableFiles(ctx, cl) }},
		{"file stores table", func() error { return tableFileStores(ctx, cl) }},
		{"assistant file stores table", func() error { return tableAssistantFileStores(ctx, cl) }},
		{"file store buckets table", func() error { return tableFileStoreBuckets(ctx, cl) }},
		{"storage-files event", func() error {
			return createEvent(ctx, cl, "files", "storage", graphiteBaseURL, "storage-files")
		}},
		{"file-store-buckets event", func() error {
			return createEvent(
				ctx,
				cl,
				"file_store_buckets",
				graphiteSchema,
				graphiteBaseURL,
				"file-store-buckets",
			)
		}},
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
				graphiteSchema, graphiteBaseURL, "auto-embeddings-configuration",
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
