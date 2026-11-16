package sqlite_test

import (
	"encoding/json/jsontext"
	"log/slog"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestExecuteOperationsRejectsDependentInsertSteps(t *testing.T) {
	t.Parallel()
	client := newTestClientWithSchema(t, `CREATE TABLE p(id INTEGER PRIMARY KEY)`)
	ops := []core.SQLOperation{{
		Name: "insert_p", Insert: &core.InsertPlan{},
	}}

	_, err := client.ExecuteOperations(t.Context(), ops, slog.New(slog.DiscardHandler))
	if err == nil ||
		!strings.Contains(err.Error(), "dependent insert steps are unsupported by SQLite") {
		t.Fatalf("ExecuteOperations error = %v", err)
	}

	result, err := client.ExecuteOperations(t.Context(), []core.SQLOperation{{
		Name: "count", SQL: `SELECT json_object('count', count(*)) FROM p`,
	}}, slog.New(slog.DiscardHandler))

	count, ok := result["count"].(jsontext.Value)
	if err != nil || !ok || !strings.Contains(string(count), `"count":0`) {
		t.Fatalf("rows after rejected steps = %v, err = %v", result, err)
	}
}
