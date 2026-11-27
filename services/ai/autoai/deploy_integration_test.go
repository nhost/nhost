//go:build integration

package autoai_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/lib/pq"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/internal/livetest"
)

// deploymentClient scopes Start to the test configuration and can make the
// deployment SQL fail after both functions were created.
type deploymentClient struct {
	*hasura.Client

	id      string
	failSQL bool
}

func (c *deploymentClient) GetAiAutoEmbeddingsConfigurations(
	ctx context.Context,
	_ *hasura.AiAutoEmbeddingsConfigurationBoolExp,
	interceptors ...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfigurations, error) {
	result, err := c.Client.GetAiAutoEmbeddingsConfigurations(
		ctx,
		&hasura.AiAutoEmbeddingsConfigurationBoolExp{ID: &hasura.UUIDComparisonExp{Eq: &c.id}},
		interceptors...)
	if err != nil {
		return nil, fmt.Errorf("list test configuration: %w", err)
	}

	return result, nil
}

func (c *deploymentClient) RunSQL(
	ctx context.Context,
	code string,
	readOnly bool,
) (*hasura.RunSQLResponse, error) {
	if c.failSQL {
		code += "\nSELECT 1/0;"
	}

	response, err := c.Client.RunSQL(ctx, code, readOnly)
	if err != nil {
		return nil, fmt.Errorf("run test deployment: %w", err)
	}

	return response, nil
}

//nolint:paralleltest // Serialized with every other package sharing the compose metadata.
func TestDeploymentLifecycleLive(t *testing.T) {
	database, hc := livetest.Connect(t)
	livetest.Lock(t, database)

	id := uuid.NewString()
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	name := "deploy_" + suffix[:20]
	schemas := []string{"deploy_" + suffix, "renamed_" + suffix}
	config := &hasura.AiAutoEmbeddingsConfigurationFragment{
		ID:         id,
		Name:       name,
		SchemaName: schemas[0],
		TableName:  "documents",
		ColumnName: "embedding",
		Provider:   "local",
		Dimensions: 2,
		Model:      "local",
	}
	logger := slog.New(slog.DiscardHandler)
	client := &deploymentClient{Client: hc, id: id, failSQL: false}
	catalog := autoai.NewSQLCatalog(database)
	ai := autoai.NewAutoAI(
		client,
		catalog,
		embedder.Registry{"local": nil},
		"http://ai:8090",
		"secret",
	)

	exec := func(query string) {
		t.Helper()

		if _, err := database.ExecContext(t.Context(), query); err != nil {
			t.Fatalf("executing test SQL failed: %v", err)
		}
	}
	table := func(schema string) string {
		return pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier("documents")
	}

	for _, schema := range schemas {
		exec("CREATE SCHEMA " + pq.QuoteIdentifier(schema) +
			"; CREATE TABLE " + table(schema) + "(id integer PRIMARY KEY, embedding vector(2))")
	}

	livetest.SuppressedExec(
		t,
		database,
		`INSERT INTO ai.auto_embeddings_configuration(id,name,schema_name,table_name,column_name,provider,dimensions,model)
		 VALUES($1,$2,$3,'documents','embedding','local',2,'local')`,
		id,
		name,
		schemas[0],
	)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), 20*time.Second)
		defer cancel()

		for _, schema := range schemas {
			trackTable(ctx, t, hc, schema, "pg_untrack_table")

			if _, err := database.ExecContext(
				ctx,
				"DROP SCHEMA "+pq.QuoteIdentifier(schema)+" CASCADE",
			); err != nil {
				t.Error("dropping test schema failed")
			}
		}

		livetest.SuppressedExec(
			t,
			database,
			`DELETE FROM ai.auto_embeddings_configuration WHERE id=$1`,
			id,
		)
	})

	// 1. An untracked target table gets a fixed message, not Hasura's text.
	err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger)
	if err == nil || !strings.Contains(err.Error(), "target table must be tracked in Hasura") {
		t.Fatalf("untracked target: %v", err)
	}

	for _, schema := range schemas {
		trackTable(t.Context(), t, hc, schema, "pg_track_table")
	}

	// 2. Deploy creates and tags both functions.
	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); err != nil {
		t.Fatal(err)
	}

	assertOwnedFunctions(t, catalog, id, schemas[0], name)

	// 3. SQL failing after both CREATEs rolls everything back.
	before := functionDefinitions(t, database, id)
	client.failSQL = true

	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); err == nil {
		t.Fatal("failing deployment succeeded")
	}

	client.failSQL = false

	if functionDefinitions(t, database, id) != before {
		t.Fatal("failed deployment changed existing functions")
	}

	// 4. A rejected edit (rename + wrong dimensions) keeps the old functions.
	config.Name = name + "_new"
	config.SchemaName = schemas[1]
	config.Dimensions = 3
	livetest.SuppressedExec(
		t,
		database,
		`UPDATE ai.auto_embeddings_configuration SET name=$2, schema_name=$3, dimensions=3 WHERE id=$1`,
		id,
		config.Name,
		config.SchemaName,
	)

	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); !errors.Is(
		err,
		autoai.ErrInvalidConfiguration,
	) {
		t.Fatalf("dimension mismatch not rejected: %v", err)
	}

	assertOwnedFunctions(t, catalog, id, schemas[0], name)

	// 5. After fixing the target, startup redeploys, removes the old names by
	// their tag and clears last_error.
	exec("ALTER TABLE " + table(schemas[1]) + " ALTER COLUMN embedding TYPE vector(3)")

	if err := ai.Start(t.Context(), logger); err != nil {
		t.Fatal(err)
	}

	assertOwnedFunctions(t, catalog, id, schemas[1], config.Name)

	var lastError sql.NullString
	if err := database.QueryRowContext(
		t.Context(),
		`SELECT last_error FROM ai.auto_embeddings_configuration WHERE id=$1`,
		id,
	).Scan(&lastError); err != nil || lastError.Valid {
		t.Fatal("successful redeploy did not clear last_error")
	}

	// 6. Delete works even after the target table is gone.
	trackTable(t.Context(), t, hc, schemas[1], "pg_untrack_table")
	exec("DROP TABLE " + table(schemas[1]) + " CASCADE")

	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, true, logger); err != nil {
		t.Fatalf("delete after target drop: %v", err)
	}

	if functions, err := catalog.TaggedFunctions(
		t.Context(),
		id,
	); err != nil ||
		len(functions) != 0 {
		t.Fatal("delete left tagged functions")
	}
}

func trackTable(ctx context.Context, t *testing.T, hc *hasura.Client, schema, op string) {
	t.Helper()

	args := map[string]any{
		"source": "default",
		"table":  map[string]any{"schema": schema, "name": "documents"},
	}
	if op == "pg_track_table" {
		args["configuration"] = map[string]any{"custom_name": "target_" + schema}
	} else {
		args["cascade"] = true
	}

	err := hc.QueryMetadata(ctx, map[string]any{"type": op, "args": args}, new(any))

	var request *hasura.MetadataRequestError

	alreadyGone := op == "pg_untrack_table" && errors.As(err, &request) &&
		(request.Body.Code == hasura.ErrorCodeNotExists || request.Body.Code == "already-untracked")
	if err != nil && !alreadyGone {
		t.Errorf("%s failed: %v", op, err)
	}
}

func assertOwnedFunctions(t *testing.T, catalog autoai.Catalog, id, wantSchema, wantName string) {
	t.Helper()

	functions, err := catalog.TaggedFunctions(t.Context(), id)
	if err != nil || len(functions) != 2 {
		t.Fatalf("expected two owned functions, got %v (%v)", functions, err)
	}

	for _, f := range functions {
		if f.Schema != wantSchema || !strings.HasSuffix(f.Name, wantName) {
			t.Fatalf("unexpected owned function %v", f)
		}
	}
}

func functionDefinitions(t *testing.T, database *sql.DB, id string) string {
	t.Helper()

	var hash string
	if err := database.QueryRowContext(
		t.Context(),
		`SELECT md5(string_agg(pg_get_functiondef(oid), '' ORDER BY proname))
		 FROM pg_proc WHERE obj_description(oid, 'pg_proc') = $1`,
		"nhost-ai:auto_embeddings:"+id,
	).Scan(&hash); err != nil {
		t.Fatal("reading function definitions failed")
	}

	return hash
}
