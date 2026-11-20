package controller_test

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const enumValuesDDL = `
CREATE TABLE enum_status (value text PRIMARY KEY, comment text);
CREATE TABLE enum_tasks (id integer PRIMARY KEY, owner integer, status text NOT NULL REFERENCES enum_status(value));
CREATE TABLE enum_control (id integer PRIMARY KEY, owner integer);
INSERT INTO enum_status VALUES ('active','active status'),('pending','pending status'),('extra','candidate');
INSERT INTO enum_tasks VALUES (1,1,'active'),(2,2,'active');
INSERT INTO enum_control VALUES (1,1),(2,2);`

//nolint:paralleltest,tparallel // Sequential variants share one fixture per backend within the testdb connection budget.
func TestEnumValueNamesHTTP(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"postgres", "sqlite"} {
		t.Run(kind, func(t *testing.T) {
			md := enumValuesMetadata(kind)
			setValue := enumValuesFixture(t, &md.Databases[0])

			tests := []struct {
				value string
				valid bool
			}{
				{"__internal", false},
				{"true", false},
				{"false", false},
				{"null", false},
				{"bad-name", false},
				{"ready", true},
				{"_Ready0", true},
				{"True", true},
			}
			for _, tt := range tests {
				t.Run(tt.value, func(t *testing.T) {
					setValue(t, tt.value)

					ctrl, err := newComputedController(t, md, false)
					if err != nil {
						t.Fatal(err)
					}

					assertEnumValuesInconsistencies(
						t,
						ctrl.Inconsistencies(),
						kind,
						tt.value,
						tt.valid,
					)

					router := newTestRouter(t, ctrl)
					for _, role := range []string{"admin", "user"} {
						assertEnumValuesHTTP(t, router, role, tt.valid)
					}
				})
			}
		})
	}
}

func enumValuesMetadata(kind string) *metadata.Metadata {
	schema := "public"
	if kind == "sqlite" {
		schema = ""
	}

	tables := []metadata.TableMetadata{
		{Table: metadata.TableSource{Schema: schema, Name: "enum_status"}, IsEnum: true},
		{
			Table: metadata.TableSource{Schema: schema, Name: "enum_tasks"},
			ObjectRelationships: []metadata.ObjectRelationship{
				{
					Name:  "state",
					Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"status"}},
				},
			},
		},
		{Table: metadata.TableSource{Schema: schema, Name: "enum_control"}},
	}
	for i := range tables {
		columns := []string{"id", "owner"}

		filter := map[string]any{"owner": map[string]any{"_eq": 1}}
		switch tables[i].Table.Name {
		case "enum_tasks":
			columns = append(columns, "status")
		case "enum_status":
			columns = []string{"value", "comment"}
			filter = nil
		}

		tables[i].SelectPermissions = []metadata.SelectPermission{
			{
				Role:       "user",
				Permission: metadata.SelectPermissionConfig{Columns: columns, Filter: filter},
			},
		}
	}

	return &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
		Name: "default", Kind: kind, Tables: tables,
	}}}
}

func enumValuesFixture(t *testing.T, md *metadata.DatabaseMetadata) func(*testing.T, string) {
	t.Helper()

	if md.Kind == "postgres" {
		pool := testdb.NewPostgres(t, enumValuesDDL)
		md.Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)

		return func(t *testing.T, value string) {
			t.Helper()

			if _, err := pool.Exec(
				t.Context(),
				`UPDATE enum_status SET value=$1 WHERE comment='candidate'`,
				value,
			); err != nil {
				t.Fatal(err)
			}
		}
	}

	path := testdb.SQLitePath(t, enumValuesDDL)

	db, err := sqlite.Open(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	})

	md.Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(path)

	return func(t *testing.T, value string) {
		t.Helper()

		if err := db.ExecContext(
			t.Context(),
			`UPDATE enum_status SET value=? WHERE comment='candidate'`,
			value,
		); err != nil {
			t.Fatal(err)
		}
	}
}

func assertEnumValuesInconsistencies(
	t *testing.T, entries []metadata.Inconsistency, kind, value string, valid bool,
) {
	t.Helper()

	if valid {
		if len(entries) != 0 {
			t.Fatalf("valid enum produced inconsistencies: %+v", entries)
		}

		return
	}

	name := "enum_status"
	if kind == "postgres" {
		name = "public." + name
	}

	if len(entries) != 2 {
		t.Fatalf("expected enum_values and relationship inconsistencies, got %+v", entries)
	}

	for _, entry := range entries {
		switch entry.Kind {
		case metadata.InconsistencyKindEnumValues:
			if entry.Source != "default" || entry.Name != name ||
				!strings.Contains(entry.Reason, fmt.Sprintf("value %q", value)) {
				t.Fatalf("incorrect enum inconsistency: %+v", entry)
			}
		case metadata.InconsistencyKindRelationship:
			if !strings.HasSuffix(entry.Name, "enum_tasks.state") {
				t.Fatalf("incorrect relationship inconsistency: %+v", entry)
			}
		default:
			t.Fatalf("unexpected inconsistency: %+v", entry)
		}
	}
}

func assertEnumValuesHTTP(t *testing.T, router http.Handler, role string, valid bool) {
	t.Helper()

	// A quoted operand is accepted only after the FK column falls back to a
	// scalar. The valid control still requires a GraphQL enum literal.
	operand, stateSelection := `"active"`, ""
	if valid {
		operand, stateSelection = "active", "state { value }"
	}

	response := nullableOrderByResponse(
		t,
		router,
		role,
		controller.GraphQLRequest{Query: fmt.Sprintf(`{
		tasks: enum_tasks(where:{status:{_eq:%s}},order_by:{id:asc}) { id status %s }
		control: enum_control(order_by:{id:asc}) { id }
	}`, operand, stateSelection)},
	)

	rows := 2
	if role == "user" {
		rows = 1
	}

	wantTasks, wantControl := make([]any, 0, rows), make([]any, 0, rows)
	for i := 1; i <= rows; i++ {
		task := map[string]any{"id": float64(i), "status": "active"}
		if valid {
			task["state"] = map[string]any{"value": "active"}
		}

		wantTasks = append(wantTasks, task)
		wantControl = append(wantControl, map[string]any{"id": float64(i)})
	}

	want := map[string]any{"tasks": wantTasks, "control": wantControl}
	if response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
		t.Fatalf("role %s: response = %+v, want data %+v", role, response, want)
	}

	response = nullableOrderByResponse(t, router, role, controller.GraphQLRequest{Query: `{
		enum: __type(name:"enum_status_enum") { name }
		table: __type(name:"enum_status") { name }
	}`})

	want = map[string]any{"enum": nil, "table": nil}
	if valid {
		want = map[string]any{
			"enum":  map[string]any{"name": "enum_status_enum"},
			"table": map[string]any{"name": "enum_status"},
		}
	}

	if response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
		t.Fatalf("role %s: enum/table introspection = %+v, want %+v", role, response, want)
	}
}
