//go:build integration

package migrations_test

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	"github.com/gqlgo/gqlgenc/clientv2"
	"github.com/nhost/nhost/services/ai/autoai"
	"github.com/nhost/nhost/services/ai/autoai/embedder"
	"github.com/nhost/nhost/services/ai/hasura"
	"github.com/nhost/nhost/services/ai/migrations"
)

// Frozen pre-registry contract. Keep this independent of the current template.
//
//nolint:unqueryvet // Preserve the deployed version-7 SQL verbatim for upgrade acceptance.
const oldSearchSQL = `CREATE FUNCTION public.ai_search_upgrade(query text, amount integer, maxDistance float DEFAULT 1.0)
RETURNS SETOF public.search_documents AS $$
DECLARE emb text;
BEGIN
 SELECT content::json->'embeddings' FROM http(('POST','http://old-service',ARRAY[]::http_header[],'application/json',jsonb_build_object('query',query,'model','old-model'))::http_request) INTO emb;
 RETURN QUERY SELECT * FROM public.search_documents LIMIT amount;
END;
$$ LANGUAGE plpgsql STABLE;`

type templateDatabase struct {
	database *sql.DB
	rendered string
}

func (d *templateDatabase) RunSQL(
	ctx context.Context,
	query string,
	_ bool,
) (*hasura.RunSQLResponse, error) {
	d.rendered = query
	if _, err := d.database.ExecContext(ctx, query); err != nil {
		return nil, fmt.Errorf("execute template SQL: %w", err)
	}

	return &hasura.RunSQLResponse{ResultType: "CommandOk", Result: nil}, nil
}
func (*templateDatabase) TrackFunction(context.Context, string, string) error   { return nil }
func (*templateDatabase) UntrackFunction(context.Context, string, string) error { return nil }

func (*templateDatabase) GetAiAutoEmbeddingsConfigurations(
	context.Context,
	*hasura.AiAutoEmbeddingsConfigurationBoolExp,
	...clientv2.RequestInterceptor,
) (*hasura.GetAiAutoEmbeddingsConfigurations, error) {
	return &hasura.GetAiAutoEmbeddingsConfigurations{AiAutoEmbeddingsConfigurations: nil}, nil
}

func (*templateDatabase) SetAiAutoEmbeddingsConfigurationLastError(
	context.Context,
	string,
	*string,
	...clientv2.RequestInterceptor,
) (*hasura.SetAiAutoEmbeddingsConfigurationLastError, error) {
	return &hasura.SetAiAutoEmbeddingsConfigurationLastError{
		UpdateAiAutoEmbeddingsConfiguration: nil,
	}, nil
}

//nolint:paralleltest // One isolated database; subtests replace its HTTP stub.
func TestSearchSQLIntegration(t *testing.T) {
	database, dsn := openAIMigrationTestDatabase(t)
	logger := slog.New(slog.DiscardHandler)

	if err := migrations.ApplyPostgresMigration(t.Context(), dsn, logger); err != nil {
		t.Fatal("migration failed")
	}

	executeAIMigrationSQL(t.Context(), t, database, `
		CREATE TABLE public.search_documents(id integer PRIMARY KEY, embedding vector(2));
		CREATE TABLE public.search_documents_new(id uuid PRIMARY KEY, embedding vector(2));
		CREATE SCHEMA other_search;
		CREATE FUNCTION other_search.ai_search_upgrade() RETURNS integer LANGUAGE sql AS 'SELECT 1';
		CREATE SCHEMA "MySchema";
		CREATE TABLE "MySchema".documents(id integer PRIMARY KEY, embedding vector(2));`)
	executeAIMigrationSQL(t.Context(), t, database, oldSearchSQL)

	boundary := &templateDatabase{database: database, rendered: ""}
	ai := autoai.NewAutoAI(
		boundary,
		autoai.NewSQLCatalog(database),
		embedder.Registry{"openai": nil},
		"http://test-service",
		"test-webhook-credential",
	)
	config := &hasura.AiAutoEmbeddingsConfigurationFragment{
		ID:         "11111111-1111-1111-1111-111111111111",
		Name:       "upgrade",
		SchemaName: "public",
		TableName:  "search_documents",
		ColumnName: "embedding",
		Model:      "text-embedding-3-small",
		Provider:   "openai",
		Dimensions: 2,
	}

	// A version-7 function with the same name is replaced by the new contract.
	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); err != nil {
		t.Fatal("search deploy failed")
	}

	for _, required := range []string{"'configuration_id'", "CURLOPT_TIMEOUT_MS", "http_reset_curlopt"} {
		if !strings.Contains(boundary.rendered, required) {
			t.Errorf("rendered search lacks %q", required)
		}
	}

	testSearchHTTPResponses(t, database)

	// A primary-key type change cannot use CREATE OR REPLACE: every overload is
	// dropped, but only in the configuration's own schema.
	config.TableName = "search_documents_new"
	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); err != nil {
		t.Fatal("redeploy with a changed primary-key type failed")
	}

	var count int
	if err := database.QueryRowContext(t.Context(), `SELECT count(*) FROM pg_proc
		WHERE pronamespace = 'public'::regnamespace AND proname IN ('ai_search_upgrade', 'ai_similar_upgrade')`).
		Scan(&count); err != nil || count != 2 {
		t.Fatal("redeploy left old overloads")
	}

	if err := database.QueryRowContext(t.Context(), `SELECT other_search.ai_search_upgrade()`).
		Scan(&count); err != nil || count != 1 {
		t.Fatal("redeploy removed another schema's function")
	}

	// Mixed-case schemas deploy, and removal is a no-op once the schema is gone.
	config.Name = "mixed_case"
	config.SchemaName = "MySchema"
	config.TableName = "documents"

	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, false, logger); err != nil {
		t.Fatal("mixed-case deploy failed")
	}

	executeAIMigrationSQL(t.Context(), t, database, `DROP SCHEMA "MySchema" CASCADE`)

	if err := ai.SynchAutoEmbeddingsConfiguration(t.Context(), config, true, logger); err != nil {
		t.Fatal("removal from a missing schema failed")
	}
}

// testSearchHTTPResponses runs the deployed search function against a stubbed
// http() and checks that every failure becomes a fixed message.
func testSearchHTTPResponses(t *testing.T, database *sql.DB) {
	t.Helper()

	executeAIMigrationSQL(t.Context(), t, database, `CREATE SCHEMA stub;
 CREATE TABLE stub.response(status integer, content text, fail boolean);
 INSERT INTO stub.response VALUES (200,'{"embeddings":[1,0]}',false);
 CREATE FUNCTION stub.http(http_request) RETURNS http_response AS $$
 DECLARE r stub.response; BEGIN
 SELECT status,content,fail INTO r FROM stub.response;
 IF r.fail THEN RAISE EXCEPTION 'private transport details'; END IF;
 RETURN (r.status,'application/json',ARRAY[]::http_header[],r.content)::http_response;
 END $$ LANGUAGE plpgsql;`)

	// Pin one session so search_path and curl options apply to the same connection.
	connection, err := database.Conn(t.Context())
	if err != nil {
		t.Fatal("opening SQL session failed")
	}
	defer connection.Close()

	if _, err := connection.ExecContext(t.Context(), `SET search_path=stub,public`); err != nil {
		t.Fatal("setting search path failed")
	}

	tests := []struct {
		name   string
		status int
		body   string
		fail   bool
		want   string // empty means success
	}{
		{"success", 200, `{"embeddings":[1,0]}`, false, ""},
		{"connection failure", 200, "", true, "embedding service connection failed"},
		{
			"invalid embeddings",
			200,
			`{"embeddings":"private"}`,
			false,
			"embedding service returned invalid embeddings",
		},
		{
			"non-JSON error",
			502,
			"private upstream body",
			false,
			"embedding service returned an invalid error response",
		},
		{
			"service error",
			422,
			`{"error":"embedding provider is not declared"}`,
			false,
			"embedding provider is not declared",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := connection.ExecContext(
				t.Context(),
				`UPDATE stub.response SET status=$1, content=$2, fail=$3`,
				tt.status, tt.body, tt.fail,
			); err != nil {
				t.Fatal("configuring stub failed")
			}

			var ignored int

			err := connection.QueryRowContext(
				t.Context(),
				`SELECT count(*) FROM public.ai_search_upgrade('query', 1)`,
			).Scan(&ignored)

			switch {
			case tt.want == "" && err != nil:
				t.Fatalf("search failed: %v", err)
			case tt.want != "" && (err == nil || !strings.Contains(err.Error(), tt.want) ||
				strings.Contains(err.Error(), "private")):
				t.Fatalf("error = %v, want %q", err, tt.want)
			}
		})
	}
}
