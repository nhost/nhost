package queries_test

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

// TestSQLiteUpsertConflictTargetIsColumnList is a regression guard for the
// conflict-target rendering. SQLite has no "ON CONFLICT ON CONSTRAINT <name>"
// form, so an upsert must target the conflict by column list. This test
// introspects a SQLite table with a named UNIQUE INDEX (which gives a
// deterministic constraint enum value equal to the index name), builds an
// upsert through the SQLite dialect, and asserts the emitted SQL targets the
// conflict by columns rather than by the PostgreSQL-only constraint form.
//
// The generated statement is not executed here: Constellation wraps inserts in
// data-modifying CTEs ("WITH ... AS (INSERT ... RETURNING *)"), a PostgreSQL
// construct SQLite cannot parse, so no SQLite insert/upsert built by this
// pipeline executes yet. That writable-CTE gap is a separate, broader concern;
// this test pins the conflict-target fix that is correct today.
func TestSQLiteUpsertConflictTargetIsColumnList(t *testing.T) {
	t.Parallel()

	md := usersMetadata()
	sqlite.FlattenMetadata(md)

	client := testdb.NewSQLite(
		t,
		`CREATE TABLE users (
			id text NOT NULL PRIMARY KEY,
			user_id text NOT NULL,
			username text NOT NULL,
			bio text NOT NULL,
			status text NOT NULL
		);
		CREATE UNIQUE INDEX users_username_key ON users(username);`,
	)

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("Introspect: %v", err)
	}

	roots, _, err := queries.BuildRoots(objects, md, &dialect.SQLiteDialect{})
	if err != nil {
		t.Fatalf("BuildRoots: %v", err)
	}

	doc, gqlErr := parser.ParseQuery(&ast.Source{Input: `
		mutation {
		  insert_users_one(
		    object: {
		      id: "id-B"
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

	if len(operations) != 1 {
		t.Fatalf("got %d operations, want 1", len(operations))
	}

	sqlText := operations[0].SQL

	if !strings.Contains(sqlText, `ON CONFLICT ("username") DO UPDATE`) {
		t.Errorf(
			"SQLite upsert must target the conflict by column list; got SQL:\n%s",
			sqlText,
		)
	}

	if strings.Contains(sqlText, "ON CONSTRAINT") {
		t.Errorf(
			"SQLite upsert must not emit the PostgreSQL-only ON CONSTRAINT form; got SQL:\n%s",
			sqlText,
		)
	}
}
