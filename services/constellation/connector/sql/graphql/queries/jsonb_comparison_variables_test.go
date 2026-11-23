package queries_test

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
)

type jsonbComparisonCase struct {
	name        string
	definitions string
	where       string
	variables   string
	wantIDs     []string
}

func jsonbComparisonCases() []jsonbComparisonCase {
	tests := []jsonbComparisonCase{
		{
			"string object operand",
			"($value:jsonb!)",
			`{data:{_eq:$value}}`,
			`{"value":"{}"}`,
			[]string{"u1"},
		},
		{
			"ordinary string operand",
			"($value:jsonb!)",
			`{data:{_eq:$value}}`,
			`{"value":"hello"}`,
			[]string{"u3"},
		},
		{
			"string null operand",
			"($value:jsonb!)",
			`{data:{_eq:$value}}`,
			`{"value":"null"}`,
			[]string{"u10"},
		},
		{"inline string", "", `{data:{_eq:"{}"}}`, `{}`, []string{"u1"}},
		{
			"whole where string",
			"($where:users_bool_exp!)",
			`$where`,
			`{"where":{"data":{"_eq":"{}"}}}`,
			[]string{"u1"},
		},
		{
			"whole containment operand",
			"($value:jsonb!)",
			`{data:{_contains:$value}}`,
			`{"value":"{}"}`,
			[]string{"u1"},
		},
		{
			"whole contained in operand",
			"($value:jsonb!)",
			`{data:{_contained_in:$value}}`,
			`{"value":"hello"}`,
			[]string{"u3"},
		},
		{
			"default string operand",
			`($value:jsonb!="{}")`,
			`{data:{_eq:$value}}`,
			`{}`,
			[]string{"u1"},
		},
		{
			"nested object operand",
			"($value:String!)",
			`{data:{_eq:{profile:{value:$value,missing:null,list:[42,true]}}}}`,
			`{"value":"{}"}`,
			[]string{"u7"},
		},
		{
			"nested membership operand",
			"($value:jsonb!)",
			`{data:{_in:[$value,{profile:{value:"{}",missing:null,list:[42,true]}}]}}`,
			`{"value":"hello"}`,
			[]string{"u3", "u7"},
		},
		{
			"whole membership operand",
			"($values:[jsonb!]!)",
			`{data:{_in:$values}}`,
			`{"values":["{}",{},"hello",42,true]}`,
			[]string{"u1", "u2", "u3", "u4", "u5"},
		},
		{
			"not in strings",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_nin":["{}","hello","null"]}}`,
			[]string{"u11", "u2", "u4", "u5", "u6", "u7", "u8"},
		},
		{
			"not equal string",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_neq":"{}"}}`,
			[]string{"u10", "u11", "u2", "u3", "u4", "u5", "u6", "u7", "u8"},
		},
		{
			"string order",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_gte":"{}","_lte":"{}"}}`,
			[]string{"u1"},
		},
		{
			"nested containment operand",
			"($value:String!)",
			`{data:{_contains:{profile:{value:$value}}}}`,
			`{"value":"{}"}`,
			[]string{"u7"},
		},
		{
			"key operand stays text",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_has_key":"profile"}}`,
			[]string{"u7"},
		},
		{
			"SQL null control",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_is_null":true}}`,
			[]string{"u9"},
		},
		{
			"explicit null operand control",
			"($cmp:jsonb_comparison_exp!)",
			`{data:$cmp}`,
			`{"cmp":{"_eq":null}}`,
			[]string{},
		},
	}

	values := []struct {
		name  string
		value string
		id    string
	}{
		{"string object", `"{}"`, "u1"},
		{"object", `{}`, "u2"},
		{"ordinary string", `"hello"`, "u3"},
		{"number", `42`, "u4"},
		{"boolean", `true`, "u5"},
		{"array", `["hello",{"nested":[null,42,true]}]`, "u6"},
		{"nested object", `{"profile":{"value":"{}","missing":null,"list":[42,true]}}`, "u7"},
		{"escaped string", `"quote\" and slash\\ and newline\n"`, "u11"},
	}

	generated := make([]jsonbComparisonCase, 0, 2*len(values)+6)
	for _, value := range values {
		for _, operator := range []string{"_eq", "_in"} {
			operand := value.value
			if operator == "_in" {
				operand = "[" + operand + "]"
			}

			generated = append(generated, jsonbComparisonCase{
				name: value.name + " " + operator, definitions: "($cmp:jsonb_comparison_exp!)",
				where: `{data:$cmp}`, variables: `{"cmp":{"` + operator + `":` + operand + `}}`,
				wantIDs: []string{value.id},
			})
		}
	}

	for _, operator := range []string{"_contains", "_contained_in"} {
		for _, value := range values[:3] {
			wantIDs := []string{value.id}
			if operator == "_contains" && value.id == "u2" {
				wantIDs = []string{"u2", "u7"}
			}

			if operator == "_contains" && value.id == "u3" {
				wantIDs = []string{"u3", "u6"}
			}

			generated = append(generated, jsonbComparisonCase{
				name: value.name + " " + operator, definitions: "($cmp:jsonb_comparison_exp!)",
				where: `{data:$cmp}`, variables: `{"cmp":{"` + operator + `":` + value.value + `}}`,
				wantIDs: wantIDs,
			})
		}
	}

	return slices.Concat(tests, generated)
}

const jsonbComparisonFixture = `TRUNCATE users;
INSERT INTO users(id,name,data) VALUES
('u1','original','"{}"'), ('u2','original','{}'), ('u3','original','"hello"'),
('u4','original','42'), ('u5','original','true'),
('u6','original','["hello",{"nested":[null,42,true]}]'),
('u7','original','{"profile":{"value":"{}","missing":null,"list":[42,true]}}'),
('u8','original','null'), ('u9','original',NULL), ('u10','original','"null"'),
('u11','original','"quote\" and slash\\ and newline\n"');`

type jsonbStoredRow struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Data    any    `json:"data"`
	SQLNull bool   `json:"sql_null"`
}

//nolint:paralleltest,tparallel // Sequential subtests share one fixture and pool to respect the testdb connection budget.
func TestJSONBComparisonVariablesExecution(t *testing.T) {
	t.Parallel()

	seed := testdb.NewPostgres(t, `CREATE TABLE users (
		id text PRIMARY KEY, name text, age int4, data jsonb, active bool, score float8
	);`, jsonbComparisonFixture)

	pool, err := postgres.Open(t.Context(), seed.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	client := postgres.NewClient(pool)
	t.Cleanup(client.Close)
	roots, schema := variableInputRoots(t)
	original := readJSONBStoredRows(t, pool)

	operations := []struct {
		name     string
		template string
	}{
		{"read", `query%s{result:users(where:%s,order_by:{id:asc}){id name data}}`},
		{
			"update",
			`mutation%s{result:update_users(where:%s,_set:{name:"updated"}){affected_rows returning{id name data}}}`,
		},
		{
			"delete",
			`mutation%s{result:delete_users(where:%s){affected_rows returning{id name data}}}`,
		},
	}
	for _, tt := range jsonbComparisonCases() {
		t.Run(tt.name, func(t *testing.T) {
			for _, operation := range operations {
				t.Run(operation.name, func(t *testing.T) {
					if err := pool.Exec(t.Context(), jsonbComparisonFixture); err != nil {
						t.Fatalf("reset fixture: %v", err)
					}

					query := fmt.Sprintf(operation.template, tt.definitions, tt.where)

					built := buildVariableInput(t, roots, schema, query, tt.variables)
					if tt.name != "SQL null control" && !strings.Contains(built[0].SQL, "$1") {
						t.Fatal("expected parameterized filter")
					}

					result, err := client.ExecuteOperations(
						t.Context(),
						built,
						slog.New(slog.DiscardHandler),
					)
					if err != nil {
						t.Fatalf("ExecuteOperations: %v", err)
					}

					wantReturning, wantStored := expectedJSONBComparisonRows(
						original,
						tt.wantIDs,
						operation.name,
					)

					assertJSONBReturning(t, result, operation.name != "read", wantReturning)

					if diff := cmp.Diff(wantStored, readJSONBStoredRows(t, pool)); diff != "" {
						t.Errorf("stored rows (-want +got):\n%s", diff)
					}
				})
			}
		})
	}
}

func expectedJSONBComparisonRows(
	original []jsonbStoredRow, ids []string, operation string,
) ([]jsonbStoredRow, []jsonbStoredRow) {
	returning := make([]jsonbStoredRow, 0, len(ids))

	stored := make([]jsonbStoredRow, 0, len(original))
	for _, row := range original {
		selected := slices.Contains(ids, row.ID)
		if selected && operation == "update" {
			row.Name = "updated"
		}

		if operation != "delete" || !selected {
			stored = append(stored, row)
		}

		if selected {
			row.SQLNull = false // Not part of the GraphQL projection.
			returning = append(returning, row)
		}
	}

	return returning, stored
}

func readJSONBStoredRows(t *testing.T, pool postgres.Pool) []jsonbStoredRow {
	t.Helper()

	var data []byte
	if err := pool.QueryRow(t.Context(), `SELECT coalesce(json_agg(u ORDER BY id),'[]')
		FROM (SELECT id,name,data,data IS NULL AS sql_null FROM users) u`).Scan(&data); err != nil {
		t.Fatalf("read stored rows: %v", err)
	}

	var rows []jsonbStoredRow
	if err := json.Unmarshal(data, &rows); err != nil {
		t.Fatalf("decode stored rows: %v", err)
	}

	return rows
}

func assertJSONBReturning(
	t *testing.T,
	result map[string]any,
	mutation bool,
	want []jsonbStoredRow,
) {
	t.Helper()

	data, err := json.Marshal(result["result"])
	if err != nil {
		t.Fatalf("encode result: %v", err)
	}

	var got []jsonbStoredRow
	if mutation {
		var response struct {
			AffectedRows int              `json:"affected_rows"`
			Returning    []jsonbStoredRow `json:"returning"`
		}
		if err := json.Unmarshal(data, &response); err != nil {
			t.Fatalf("decode mutation: %v", err)
		}

		if response.AffectedRows != len(want) {
			t.Errorf("affected_rows = %d, want %d", response.AffectedRows, len(want))
		}

		got = response.Returning
	} else if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("decode read: %v", err)
	}

	slices.SortFunc(got, func(a, b jsonbStoredRow) int { return strings.Compare(a.ID, b.ID) })

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("returned rows (-want +got):\n%s", diff)
	}
}
