package sql_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func computedFixture(t *testing.T, filename string) []byte {
	t.Helper()

	return computedFile(t, filepath.Join("../../integration/computedfields/testdata", filename))
}

func computedFile(t *testing.T, path string) []byte {
	t.Helper()

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read computed fixture %s: %v", path, err)
	}

	return content
}

func computedTestDB(t *testing.T) *pgx.Conn {
	t.Helper()

	pool := testdb.NewPostgres(
		t,
		string(
			computedFile(
				t,
				"../../integration/nhost/migrations/default/1790001000000_computed_fields/up.sql",
			),
		),
		string(computedFile(t, "../../integration/nhost/seeds/default/40-computed-fields.sql")),
	)

	conn, err := pgx.Connect(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("connect to computed test database: %v", err)
	}

	t.Cleanup(func() {
		if err := conn.Close(t.Context()); err != nil {
			t.Errorf("close computed test database: %v", err)
		}
	})

	return conn
}

func assertComputedFixtureSchema(t *testing.T, roleSchema *graph.Schema) {
	t.Helper()

	if roleSchema == nil {
		t.Fatal("computed fixture role has no schema")
	}

	for _, obj := range roleSchema.Types {
		if obj.Name != "cf_select_items" {
			continue
		}

		foundScalar := false
		for _, field := range obj.Fields {
			if field.Name == "item_label" {
				foundScalar = true
			}

			if field.Name == "item_tags" {
				t.Fatal("table-valued computed field exposed before its execution gate")
			}
		}

		if !foundScalar {
			t.Fatal("production scalar selection missing from fixture role")
		}

		return
	}

	t.Fatal("tracked fixture table is missing from the role schema")
}

// TestComputedFieldsFixtureSmoke exercises the checked-in, independent
// Constellation path against an isolated testdb; it needs no Hasura endpoint.
func TestComputedFieldsFixtureSmoke(t *testing.T) {
	t.Parallel()

	meta, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatalf("load computed fixture metadata: %v", err)
	}

	if len(meta.Databases) != 2 {
		t.Fatalf("expected two computed fixture sources, got %d", len(meta.Databases))
	}

	fixtureDB := computedTestDB(t)

	pgPool, err := postgres.Open(t.Context(), fixtureDB.Config().ConnString())
	if err != nil {
		t.Fatalf("connect to computed fixture database: %v", err)
	}

	conn, err := csql.NewConnector(
		t.Context(), postgres.NewClient(pgPool), &meta.Databases[0], nil, slog.Default(),
	)
	if err != nil {
		pgPool.Close()
		t.Fatalf("build computed fixture connector: %v", err)
	}

	t.Cleanup(conn.Close)

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatalf("get computed fixture schemas: %v", err)
	}

	assertComputedFixtureSchema(t, schemas["cf_reader"])

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		cf_select_items(order_by: {id: asc}) { id label }
	}`})
	if err != nil {
		t.Fatalf("parse computed fixture smoke query: %v", err)
	}

	result, err := conn.Execute(
		t.Context(), doc.Operations[0], nil, nil, "cf_reader", nil, slog.Default(),
	)
	if err != nil {
		t.Fatalf("execute computed fixture smoke query: %v", err)
	}

	payload, ok := result["cf_select_items"].(jsontext.Value)
	if !ok {
		t.Fatalf("expected JSON result for fixture table, got %T", result["cf_select_items"])
	}

	var rows []struct {
		ID    int    `json:"id"`
		Label string `json:"label"`
	}
	if err := json.Unmarshal(payload, &rows); err != nil {
		t.Fatalf("decode computed fixture result: %v", err)
	}

	want := []struct {
		ID    int    `json:"id"`
		Label string `json:"label"`
	}{{1, "first"}, {2, "second"}}
	if diff := cmp.Diff(want, rows); diff != "" {
		t.Errorf("fixture results differ (-want +got):\n%s", diff)
	}
}

type computedRoleField struct {
	Type string            `json:"type"`
	Args map[string]string `json:"args"`
}

type computedRoleShape struct {
	Role             string                       `json:"role"`
	ObjectFields     map[string]computedRoleField `json:"object_fields"`
	ColumnTypes      map[string]string            `json:"column_types"`
	ColumnBoolTypes  map[string]string            `json:"column_bool_types"`
	ColumnOrderTypes map[string]string            `json:"column_order_types"`
	BoolFields       map[string]string            `json:"bool_fields"`
	OrderFields      map[string]string            `json:"order_fields"`
	ArgsTypes        map[string]map[string]string `json:"args_types"`
	AbsentFields     []string                     `json:"absent_fields"`
}

// TestComputedFieldsContractFixture pins independent reference expectations.
// GraphQL cases become executable as the schema and execution gates are implemented.
func TestComputedFieldsContractFixture(t *testing.T) {
	t.Parallel()

	var contract struct {
		Source string              `json:"source"`
		Roles  []computedRoleShape `json:"roles"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatalf("decode contract: %v", err)
	}

	if contract.Source != "cf_select" || len(contract.Roles) != 3 {
		t.Fatal("contract is missing source or role expectations")
	}

	for _, role := range contract.Roles {
		t.Run(role.Role, func(t *testing.T) {
			t.Parallel()
			checkComputedRoleColumns(t, role)
			checkComputedRoleFields(t, role)
		})
	}
}

func checkComputedRoleColumns(t *testing.T, role computedRoleShape) {
	t.Helper()

	if role.ObjectFields == nil || role.BoolFields == nil || role.OrderFields == nil ||
		role.ArgsTypes == nil || role.AbsentFields == nil || role.ColumnTypes == nil ||
		role.ColumnBoolTypes == nil || role.ColumnOrderTypes == nil {
		t.Fatal("missing role SDL shape or absence expectations")
	}

	columns := map[string]string{"id": "Int!", "label": "String!"}
	if role.Role != "cf_no_grant" {
		columns["amount"] = "numeric!"
		columns["payload"] = "jsonb!"
	}

	if role.Role == "admin" {
		columns["owner_id"] = "Int!"
	}

	boolColumns := make(map[string]string, len(columns))

	orderColumns := make(map[string]string, len(columns))
	for name, typ := range columns {
		boolColumns[name] = strings.TrimSuffix(typ, "!") + "_comparison_exp"
		orderColumns[name] = "order_by"
	}

	if diff := cmp.Diff(columns, role.ColumnTypes); diff != "" {
		t.Errorf("object column types (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(boolColumns, role.ColumnBoolTypes); diff != "" {
		t.Errorf("bool column types (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(orderColumns, role.ColumnOrderTypes); diff != "" {
		t.Errorf("order column types (-want +got):\n%s", diff)
	}
}

func checkComputedRoleFields(t *testing.T, role computedRoleShape) {
	t.Helper()

	if role.Role == "cf_no_grant" {
		if len(role.ObjectFields) != 0 || len(role.BoolFields) != 0 ||
			len(role.OrderFields) != 0 || len(role.ArgsTypes) != 0 ||
			!cmp.Equal(role.AbsentFields, []string{
				"item_label", "item_payload", "item_score", "item_second", "item_tags",
				"item_score_cf_select_items_args", "item_second_cf_select_items_args",
			}) {
			t.Fatal("ungranted role must not expose computed fields or either args type")
		}

		return
	}

	wantFields := map[string]computedRoleField{
		"item_label":   {Type: "String", Args: map[string]string{}},
		"item_payload": {Type: "jsonb", Args: map[string]string{"path": "String"}},
		"item_score": {
			Type: "numeric", Args: map[string]string{"args": "item_score_cf_select_items_args"},
		},
		"item_second": {
			Type: "numeric", Args: map[string]string{"args": "item_second_cf_select_items_args!"},
		},
		"item_tags": {
			Type: "[cf_select_tags!]",
			Args: map[string]string{
				"distinct_on": "[cf_select_tags_select_column!]", "limit": "Int", "offset": "Int",
				"order_by": "[cf_select_tags_order_by!]", "where": "cf_select_tags_bool_exp",
			},
		},
	}
	if diff := cmp.Diff(wantFields, role.ObjectFields); diff != "" {
		t.Errorf("object computed fields (-want +got):\n%s", diff)
	}

	wantArgs := map[string]map[string]string{
		"item_score_cf_select_items_args":  {"multiplier": "Int"},
		"item_second_cf_select_items_args": {"multiplier": "Int"},
	}
	if diff := cmp.Diff(wantArgs, role.ArgsTypes); diff != "" {
		t.Errorf("argument input fields (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(map[string]string{
		"item_label": "String_comparison_exp", "item_payload": "jsonb_comparison_exp",
		"item_tags": "cf_select_tags_bool_exp",
	}, role.BoolFields); diff != "" {
		t.Errorf("bool computed fields (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(map[string]string{
		"item_label": "order_by", "item_payload": "order_by",
		"item_tags_aggregate": "cf_select_tags_aggregate_order_by",
	}, role.OrderFields); diff != "" {
		t.Errorf("order computed fields (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(
		[]string{"item_score in bool_exp", "item_score in order_by"},
		role.AbsentFields,
	); diff != "" {
		t.Errorf("absent inputs (-want +got):\n%s", diff)
	}
}

func TestComputedFieldsGraphQLCasesFixture(t *testing.T) {
	t.Parallel()

	var contract struct {
		Cases []struct {
			Role     string         `json:"role"`
			Query    string         `json:"query"`
			Response jsontext.Value `json:"response"`
			Error    jsontext.Value `json:"error"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatalf("decode GraphQL contract: %v", err)
	}

	if len(contract.Cases) < 4 {
		t.Fatal("missing GraphQL response cases")
	}

	for _, tc := range contract.Cases {
		if tc.Role == "" || tc.Query == "" || (len(tc.Response) == 0) == (len(tc.Error) == 0) {
			t.Fatalf("incomplete GraphQL contract case: %q", tc.Query)
		}

		if _, err := parser.ParseQuery(&ast.Source{Input: tc.Query}); err != nil {
			t.Fatalf("invalid contract GraphQL: %v", err)
		}
	}
}

type computedMetadataSource struct {
	Name          string           `json:"name"`
	Kind          string           `json:"kind"`
	Configuration map[string]any   `json:"configuration"`
	Tables        []map[string]any `json:"tables"`
}

func TestComputedFieldsMetadataFixture(t *testing.T) {
	t.Parallel()

	var wire struct {
		Sources []computedMetadataSource `json:"sources"`
	}
	if err := json.Unmarshal(computedFixture(t, "metadata.json"), &wire); err != nil {
		t.Fatalf("decode wire metadata: %v", err)
	}

	if len(wire.Sources) != 2 || wire.Sources[0].Name != "cf_select" ||
		wire.Sources[1].Name != "cf_predicates" {
		t.Fatal("contract sources do not match directory metadata")
	}

	var directorySources []map[string]any
	if err := yaml.Unmarshal(
		computedFile(t, "../../integration/nhost/metadata/databases/databases.yaml"),
		&directorySources,
	); err != nil {
		t.Fatalf("decode directory source list: %v", err)
	}

	for _, source := range wire.Sources {
		t.Run(source.Name, func(t *testing.T) {
			t.Parallel()
			checkComputedDirectorySource(t, source, directorySources)
		})
	}
}

func checkComputedDirectorySource(
	t *testing.T,
	source computedMetadataSource,
	directorySources []map[string]any,
) {
	t.Helper()

	var directory map[string]any
	for _, entry := range directorySources {
		if entry["name"] == source.Name {
			directory = entry
			break
		}
	}

	if directory == nil {
		t.Fatalf("source %s absent from directory metadata", source.Name)
	}

	if source.Kind != "postgres" || directory["kind"] != source.Kind {
		t.Fatalf("%s source backend differs from directory metadata", source.Name)
	}

	if diff := cmp.Diff(
		normalizeComputedYAML(t, directory["configuration"]),
		source.Configuration,
	); diff != "" {
		t.Errorf("%s configuration drift (-YAML +JSON):\n%s", source.Name, diff)
	}

	tracked := make([]string, 0, len(source.Tables))
	for _, table := range source.Tables {
		tracked = append(tracked, checkComputedDirectoryTable(t, source.Name, table))
	}

	var listed []string

	path := filepath.Join(
		"../../integration/nhost/metadata/databases",
		source.Name,
		"tables/tables.yaml",
	)
	if err := yaml.Unmarshal(computedFile(t, path), &listed); err != nil {
		t.Fatalf("decode directory tracked tables: %v", err)
	}

	if diff := cmp.Diff(tracked, listed); diff != "" {
		t.Errorf("%s tracked tables drift (-JSON +YAML):\n%s", source.Name, diff)
	}
}

func normalizeComputedYAML(t *testing.T, value any) map[string]any {
	t.Helper()

	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("encode YAML data: %v", err)
	}

	var normalized map[string]any
	if err := json.Unmarshal(encoded, &normalized); err != nil {
		t.Fatalf("normalize YAML data: %v", err)
	}

	return normalized
}

func checkComputedDirectoryTable(t *testing.T, source string, table map[string]any) string {
	t.Helper()

	identity, ok := table["table"].(map[string]any)
	if !ok {
		t.Fatal("missing fixture table identity")
	}

	name, ok := identity["name"].(string)
	if !ok || identity["schema"] != source {
		t.Fatalf("invalid tracked table: %v", identity)
	}

	path := filepath.Join(
		"../../integration/nhost/metadata/databases",
		source,
		"tables",
		source+"_"+name+".yaml",
	)

	var directory map[string]any
	if err := yaml.Unmarshal(computedFile(t, path), &directory); err != nil {
		t.Fatalf("decode directory table: %v", err)
	}

	// Compare definitions and grants, including aggregate access, so the
	// standalone metadata cannot silently diverge from the live YAML.
	if diff := cmp.Diff(normalizeComputedYAML(t, directory), table); diff != "" {
		t.Errorf("%s/%s directory/JSON drift (-YAML +JSON):\n%s", source, name, diff)
	}

	return "!include " + source + "_" + name + ".yaml"
}

// computedContractConn provides a new, independently seeded testdb to each
// SQL expectation (no Hasura endpoint or shared integration rows).
func computedContractConn(t *testing.T) *pgx.Conn {
	t.Helper()

	return computedTestDB(t)
}

func TestComputedFieldsContractSQL(t *testing.T) {
	t.Parallel()

	var contract struct {
		SQL struct {
			Query string  `json:"query"`
			Rows  [][]any `json:"rows"`
		} `json:"sql"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatalf("decode SQL contract: %v", err)
	}

	conn := computedContractConn(t)

	rows, err := conn.Query(t.Context(), contract.SQL.Query)
	if err != nil {
		t.Fatalf("execute contract SQL: %v", err)
	}
	defer rows.Close()

	var got [][]any
	for rows.Next() {
		var (
			id             int32
			label, payload string
			score          float64
			tags           int64
		)
		if err := rows.Scan(&id, &label, &score, &payload, &tags); err != nil {
			t.Fatalf("scan contract SQL: %v", err)
		}

		got = append(got, []any{float64(id), label, score, payload, float64(tags)})
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("read contract SQL: %v", err)
	}

	if diff := cmp.Diff(contract.SQL.Rows, got); diff != "" {
		t.Errorf("contract SQL results differ (-want +got):\n%s", diff)
	}
}

type computedArgumentCase struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	Query    string `json:"query"`
	Response struct {
		Data struct {
			Items []struct {
				ID    int     `json:"id"`
				Score float64 `json:"item_score"`
			} `json:"cf_select_items"`
		} `json:"data"`
	} `json:"response"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func TestComputedFieldsDefaultArgumentContract(t *testing.T) {
	t.Parallel()

	var contract struct {
		Cases []computedArgumentCase `json:"cases"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatalf("decode default argument contract: %v", err)
	}

	cases := map[string]computedArgumentCase{}
	for _, tc := range contract.Cases {
		cases[tc.Name] = tc
	}

	checkComputedDefaultArgument(t, cases["default-argument"])

	tc := cases["required-argument-omitted"]
	if tc.Role != "cf_reader" || !strings.Contains(tc.Query, "item_second(args:{})") ||
		tc.Error.Code != "not-supported" ||
		tc.Error.Message != "Non default arguments cannot be omitted" {
		t.Fatal("missing required-argument error contract")
	}
}

func checkComputedDefaultArgument(t *testing.T, tc computedArgumentCase) {
	t.Helper()

	if tc.Role != "cf_reader" || !strings.Contains(tc.Query, "item_score }") ||
		len(tc.Response.Data.Items) != 1 || tc.Response.Data.Items[0].ID != 1 {
		t.Fatal("default query/response missing")
	}

	conn := computedContractConn(t)

	var score float64
	if err := conn.QueryRow(t.Context(), "SELECT cf_select.item_score(i)::float8 FROM cf_select.items AS i WHERE id = 1").
		Scan(&score); err != nil {
		t.Fatalf("evaluate SQL default: %v", err)
	}

	if score != tc.Response.Data.Items[0].Score {
		t.Fatalf("SQL default got %v, contract wants %v", score, tc.Response.Data.Items[0].Score)
	}
}

func TestComputedFieldsSecondRowArgumentSQL(t *testing.T) {
	t.Parallel()

	var contract struct {
		SecondRowSQL struct {
			Query  string    `json:"query"`
			Values []float64 `json:"values"`
		} `json:"second_row_sql"`
	}
	if err := json.Unmarshal(computedFixture(t, "contract.json"), &contract); err != nil {
		t.Fatalf("decode second-row-argument contract: %v", err)
	}

	conn := computedContractConn(t)

	rows, err := conn.Query(t.Context(), contract.SecondRowSQL.Query)
	if err != nil {
		t.Fatalf("execute second-row-argument SQL: %v", err)
	}
	defer rows.Close()

	var got []float64
	for rows.Next() {
		var result float64
		if err := rows.Scan(&result); err != nil {
			t.Fatalf("scan second-row-argument SQL: %v", err)
		}

		got = append(got, result)
	}

	if err := rows.Err(); err != nil {
		t.Fatalf("read second-row-argument SQL: %v", err)
	}

	if diff := cmp.Diff(contract.SecondRowSQL.Values, got); diff != "" {
		t.Errorf("second-row-argument results differ (-want +got):\n%s", diff)
	}
}

type predicateContract struct {
	Source           string `json:"source"`
	SelectPermission struct {
		Role       string `json:"role"`
		Permission struct {
			Filter map[string]any `json:"filter"`
		} `json:"permission"`
	} `json:"select_permission"`
	UpdatePermission struct {
		Permission struct {
			Filter map[string]any `json:"filter"`
			Check  map[string]any `json:"check"`
		} `json:"permission"`
	} `json:"update_permission"`
	InsertPermission struct {
		Permission struct {
			Check map[string]any `json:"check"`
		} `json:"permission"`
	} `json:"insert_permission"`
	Expected struct {
		Role     string  `json:"role"`
		Query    string  `json:"query"`
		Response any     `json:"response"`
		SQL      string  `json:"sql"`
		SQLRows  [][]any `json:"sql_rows"`
	} `json:"expected"`
}

func loadPredicateContract(t *testing.T) predicateContract {
	t.Helper()

	var predicate predicateContract

	if err := json.Unmarshal(
		computedFixture(t, "predicate_permissions.json"),
		&predicate,
	); err != nil {
		t.Fatalf("decode predicate contract: %v", err)
	}

	return predicate
}

func TestComputedFieldsPredicateMetadata(t *testing.T) {
	t.Parallel()

	predicate := loadPredicateContract(t)
	if predicate.Source != "cf_predicates" ||
		predicate.Expected.Role != predicate.SelectPermission.Role ||
		predicate.Expected.Response == nil ||
		predicate.Expected.Query == "" ||
		predicate.SelectPermission.Permission.Filter["rule_visible"] == nil ||
		predicate.UpdatePermission.Permission.Filter["rule_visible"] == nil ||
		predicate.UpdatePermission.Permission.Check["rule_visible"] == nil ||
		predicate.InsertPermission.Permission.Check["rule_visible"] == nil {
		t.Fatal("predicate contract missing source, role, response, filter or check")
	}
}

func TestComputedFieldsPredicateContractSQL(t *testing.T) {
	t.Parallel()

	predicate := loadPredicateContract(t)
	conn := computedContractConn(t)

	predicateRows, err := conn.Query(t.Context(), predicate.Expected.SQL)
	if err != nil {
		t.Fatalf("execute predicate SQL: %v", err)
	}
	defer predicateRows.Close()

	var filtered [][]any
	for predicateRows.Next() {
		var (
			id    int32
			label string
		)
		if err := predicateRows.Scan(&id, &label); err != nil {
			t.Fatalf("scan predicate SQL: %v", err)
		}

		filtered = append(filtered, []any{float64(id), label})
	}

	if err := predicateRows.Err(); err != nil {
		t.Fatalf("read predicate SQL: %v", err)
	}

	if diff := cmp.Diff(predicate.Expected.SQLRows, filtered); diff != "" {
		t.Errorf("predicate SQL differs (-want +got):\n%s", diff)
	}

	response, ok := predicate.Expected.Response.(map[string]any)
	if !ok {
		t.Fatal("predicate expected response has no data envelope")
	}

	data, ok := response["data"].(map[string]any)
	if !ok {
		t.Fatal("predicate expected response has no data")
	}

	responseRows, ok := data["cf_predicates_rules"].([]any)
	if !ok || len(responseRows) != len(filtered) {
		t.Fatal("predicate role response differs from SQL row count")
	}

	for i, row := range responseRows {
		fields, ok := row.(map[string]any)
		if !ok || fields["id"] != filtered[i][0] || fields["label"] != filtered[i][1] {
			t.Fatalf("predicate role response differs from SQL row %d", i)
		}
	}
}
