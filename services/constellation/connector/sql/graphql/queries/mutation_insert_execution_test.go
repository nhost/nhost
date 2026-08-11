package queries_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestPostgresUpsertUpdateActionMarkerColumnCollisionExecutes(t *testing.T) {
	t.Parallel()

	seedPool := testdb.NewPostgres(
		t,
		`CREATE TABLE public.users (
			id uuid NOT NULL PRIMARY KEY,
			user_id text NOT NULL,
			username text NOT NULL,
			bio text NOT NULL,
			status text NOT NULL,
			"__nhost_upsert_updated" boolean NOT NULL DEFAULT false,
			"__nhost_upsert_updated_1" boolean NOT NULL DEFAULT true,
			CONSTRAINT users_username_key UNIQUE (username)
		);`,
		`INSERT INTO public.users (id, user_id, username, bio, status)
		 VALUES ('00000000-0000-0000-0000-0000000000aa', 'user-A', 'alice', 'old bio', 'pending');`,
	)

	pool, err := postgres.Open(t.Context(), seedPool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("postgres.Open: %v", err)
	}

	t.Cleanup(pool.Close)

	client := postgres.NewClient(pool)

	objects, err := client.Introspect(t.Context(), usersMetadata())
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, usersMetadata(), &dialect.PostgresDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: `
		mutation {
		  insert_users_one(
		    object: {
		      id: "00000000-0000-0000-0000-000000000001"
		      user_id: "user-A"
		      username: "alice"
		      bio: "updated bio"
		      status: "pending"
		    }
		    on_conflict: {
		      constraint: users_username_key
		      update_columns: [bio, status]
		    }
		  ) {
		    username
		    bio
		  }
		}`})
	if gqlErr != nil {
		t.Fatalf("ParseQuery: %v", gqlErr)
	}

	operations, err := roots.BuildQuery(
		doc.Operations[0],
		doc.Fragments,
		nil,
		"user",
		map[string]any{"x-hasura-user-id": "user-A"},
	)
	if err != nil {
		t.Fatalf("BuildQuery: %v", err)
	}

	results, err := client.ExecuteOperations(
		t.Context(), operations, slog.New(slog.DiscardHandler),
	)
	if err != nil {
		t.Fatalf("ExecuteOperations: %v", err)
	}

	value, ok := results["insert_users_one"].(jsontext.Value)
	if !ok {
		t.Fatalf("insert_users_one result = %T, want jsontext.Value", results["insert_users_one"])
	}

	var payload map[string]any
	if err := json.Unmarshal(value, &payload); err != nil {
		t.Fatalf("unmarshal result: %v", err)
	}

	if payload["bio"] != "updated bio" {
		t.Fatalf("bio result = %v, want updated bio; full payload: %#v", payload["bio"], payload)
	}

	var (
		bio                string
		realMarker         bool
		realMarkerWithSuff bool
	)
	if err := pool.QueryRow(
		t.Context(),
		`SELECT bio, "__nhost_upsert_updated", "__nhost_upsert_updated_1"
		 FROM public.users WHERE username = $1`,
		"alice",
	).Scan(&bio, &realMarker, &realMarkerWithSuff); err != nil {
		t.Fatalf("querying updated row: %v", err)
	}

	if bio != "updated bio" {
		t.Errorf("stored bio = %q, want updated bio", bio)
	}

	if realMarker {
		t.Error("real __nhost_upsert_updated column was changed or shadowed; want false")
	}

	if !realMarkerWithSuff {
		t.Error("real __nhost_upsert_updated_1 column was changed or shadowed; want true")
	}
}

func usersMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: "user",
						Permission: metadata.SelectPermissionConfig{
							Columns: []string{"username", "bio"},
							Filter: map[string]any{
								"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
							},
						},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{
							Columns: []string{"id", "user_id", "username", "bio", "status"},
							Check: map[string]any{
								"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
							},
						},
					},
				},
				UpdatePermissions: []metadata.UpdatePermission{
					{
						Role: "user",
						Permission: metadata.UpdatePermissionConfig{
							Columns: []string{"bio", "status"},
							Filter: map[string]any{
								"user_id": map[string]any{"_eq": "X-Hasura-User-Id"},
							},
							Check: map[string]any{"status": map[string]any{"_eq": "pending"}},
						},
					},
				},
			},
		},
	}
}
