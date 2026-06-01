package queries_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestSubscriptionFunctionSessionArgumentUsesEachSubscriberSession(t *testing.T) {
	t.Parallel()

	fixture := newSessionEchoFixture(t)
	operation := buildSessionEchoSubscription(t, fixture.roots)
	results := executeSessionEchoSubscription(t, fixture.pool, operation)

	assertSessionEcho(t, results, "sub-a", "user-a")
	assertSessionEcho(t, results, "sub-b", "user-b")
}

type sessionEchoFixture struct {
	pool  *pgxpool.Pool
	roots queries.Roots
}

func newSessionEchoFixture(t *testing.T) sessionEchoFixture {
	t.Helper()

	ddl, err := os.ReadFile("testdata/pg_schema.sql")
	if err != nil {
		t.Fatalf("failed to read test DDL: %v", err)
	}

	seeds, err := os.ReadFile("testdata/pg_seeds.sql")
	if err != nil {
		t.Fatalf("failed to read test seeds: %v", err)
	}

	pool := testdb.NewPostgres(t, string(ddl)+sessionEchoFunctionDDL, string(seeds))
	md := sessionEchoMetadata(t)

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("failed to open postgres pool: %v", err)
	}

	pgClient := postgres.NewClient(pgPool)
	t.Cleanup(func() { pgClient.Close() })

	objects, err := pgClient.Introspect(t.Context(), &md.Databases[0])
	if err != nil {
		t.Fatalf("failed to introspect database: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, &md.Databases[0], &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("failed to build roots: %v", err)
	}

	return sessionEchoFixture{pool: pool, roots: roots}
}

func sessionEchoMetadata(t *testing.T) *metadata.Metadata {
	t.Helper()

	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	md.Databases[0].Tables = append(md.Databases[0].Tables, metadata.TableMetadata{
		Table: metadata.TableSource{Name: "session_echoes", Schema: "public"},
	})
	md.Databases[0].Functions = append(md.Databases[0].Functions, metadata.FunctionMetadata{
		Function: metadata.FunctionSource{Name: "session_echoes_for_session", Schema: "public"},
		Configuration: metadata.FunctionConfiguration{
			ExposedAs:       "query",
			SessionArgument: "session",
		},
	})

	return md
}

func buildSessionEchoSubscription(t *testing.T, roots queries.Roots) core.SQLOperation {
	t.Helper()

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: `
		subscription {
		  session_echoes_for_session {
			id
			user_id
			role
		  }
		}`})
	if gqlErr != nil {
		t.Fatalf("failed to parse query: %v", gqlErr)
	}

	operations, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		nil,
		"admin",
		map[string]any{
			"x-hasura-role":    "x-hasura-role",
			"x-hasura-user-id": "x-hasura-user-id",
		},
	)
	if err != nil {
		t.Fatalf("failed to build subscription query: %v", err)
	}

	if len(operations) != 1 {
		t.Fatalf("operations length = %d, want 1", len(operations))
	}

	return operations[0]
}

func executeSessionEchoSubscription(
	t *testing.T,
	pool *pgxpool.Pool,
	operation core.SQLOperation,
) map[string]sessionEchoPayload {
	t.Helper()

	params := multiplexed.PrepareParams(
		[]string{"sub-a", "sub-b"},
		map[string][]any{
			"x-hasura-role":    {"user", "user"},
			"x-hasura-user-id": {"user-a", "user-b"},
		},
		nil,
	)
	params = append(params, operation.Parameters...)

	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin transaction: %v", err)
	}
	defer tx.Rollback(t.Context()) //nolint:errcheck

	rows, err := tx.Query(t.Context(), operation.SQL, params...)
	if err != nil {
		t.Fatalf("failed to execute subscription query: %v", err)
	}
	defer rows.Close()

	results := make(map[string]sessionEchoPayload)
	for rows.Next() {
		subscriptionID, payload := scanSessionEchoResult(t, rows)
		results[subscriptionID] = payload
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("subscription rows error: %v", err)
	}

	return results
}

func scanSessionEchoResult(t *testing.T, rows pgx.Rows) (string, sessionEchoPayload) {
	t.Helper()

	var (
		subscriptionID string
		data           []byte
	)

	if err := rows.Scan(&subscriptionID, &data); err != nil {
		t.Fatalf("failed to scan subscription result: %v", err)
	}

	var payload sessionEchoPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("failed to decode subscription result for %s: %v", subscriptionID, err)
	}

	return subscriptionID, payload
}

const sessionEchoFunctionDDL = `
CREATE TABLE public.session_echoes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION public.session_echoes_for_session(session json)
  RETURNS SETOF public.session_echoes
  LANGUAGE sql STABLE AS $$
    SELECT
      session ->> 'x-hasura-user-id' AS id,
      session ->> 'x-hasura-user-id' AS user_id,
      session ->> 'x-hasura-role' AS role;
  $$;
`

type sessionEchoPayload struct {
	SessionEchoesForSession []sessionEcho `json:"session_echoes_for_session"`
}

type sessionEcho struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

func assertSessionEcho(
	t *testing.T,
	results map[string]sessionEchoPayload,
	subscriptionID string,
	wantUserID string,
) {
	t.Helper()

	payload, ok := results[subscriptionID]
	if !ok {
		t.Fatalf("missing result for subscription %s", subscriptionID)
	}

	if len(payload.SessionEchoesForSession) != 1 {
		t.Fatalf(
			"%s row count = %d, want 1",
			subscriptionID,
			len(payload.SessionEchoesForSession),
		)
	}

	row := payload.SessionEchoesForSession[0]
	if row.ID != wantUserID || row.UserID != wantUserID || row.Role != "user" {
		t.Fatalf(
			"%s row = %+v, want id/user_id %q and role user",
			subscriptionID,
			row,
			wantUserID,
		)
	}
}
