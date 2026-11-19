package sql_test

import (
	json "encoding/json/v2"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// These cases replay reference metadata/DDL inputs in an isolated PostgreSQL
// database. The variants also have separate reconciliation and served-role
// assertions; replaying the wire data alone does not prove GraphQL behavior.
type computedVariant struct {
	Name               string         `json:"name"`
	Source             string         `json:"source"`
	Table              string         `json:"table"`
	MetadataOperation  string         `json:"metadata_operation"`
	Definition         map[string]any `json:"definition"`
	RemoteRelationship map[string]any `json:"remote_relationship"`
	DDL                string         `json:"ddl"`
	SQL                string         `json:"sql"`
	SQLResult          *bool          `json:"sql_result"`
	SQLValue           string         `json:"sql_value"`
	PermissionFilter   map[string]any `json:"permission_filter"`
	ComputedFields     []string       `json:"computed_fields"`
	InconsistentKinds  []string       `json:"inconsistent_kinds"`
	InconsistentKind   string         `json:"inconsistent_kind"`
	ErrorCode          string         `json:"error_code"`
	Reason             string         `json:"reason"`
	Role               string         `json:"role"`
	TypeName           string         `json:"type_name"`
	TypeAbsent         bool           `json:"type_absent"`
	Query              string         `json:"query"`
	Error              map[string]any `json:"error"`
}

type computedMetadataWire struct {
	Version int   `json:"version"`
	Sources []any `json:"sources"`
}

func computedObject(t *testing.T, value any) map[string]any {
	t.Helper()

	object, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected metadata object, got %T", value)
	}

	return object
}

func computedArray(t *testing.T, value any) []any {
	t.Helper()

	array, ok := value.([]any)
	if !ok {
		t.Fatalf("expected metadata array, got %T", value)
	}

	return array
}

func computedString(t *testing.T, value any) string {
	t.Helper()

	str, ok := value.(string)
	if !ok {
		t.Fatalf("expected metadata string, got %T", value)
	}

	return str
}

func computedVariantTable(t *testing.T, sources []any, tc computedVariant) map[string]any {
	t.Helper()

	for _, entry := range sources {
		source := computedObject(t, entry)
		if source["name"] != tc.Source {
			continue
		}

		for _, entry := range computedArray(t, source["tables"]) {
			table := computedObject(t, entry)

			identity := computedObject(t, table["table"])
			if computedString(
				t,
				identity["schema"],
			)+"."+computedString(
				t,
				identity["name"],
			) == tc.Table {
				return table
			}
		}
	}

	t.Fatalf("variant %s has no tracked source/table %s/%s", tc.Name, tc.Source, tc.Table)

	return nil
}

func computedVariantFields(t *testing.T, table map[string]any, key string) []any {
	t.Helper()

	return computedArray(t, table[key])
}

func computedVariantPermission(t *testing.T, table map[string]any, role string) map[string]any {
	t.Helper()

	for _, entry := range computedVariantFields(t, table, "select_permissions") {
		perm := computedObject(t, entry)
		if perm["role"] == role {
			return computedObject(t, perm["permission"])
		}
	}

	t.Fatalf("role %s is not granted on tracked table", role)

	return nil
}

func loadComputedMetadata(t *testing.T) computedMetadataWire {
	t.Helper()

	var wire computedMetadataWire
	if err := json.Unmarshal(computedFixture(t, "metadata.json"), &wire); err != nil {
		t.Fatalf("decode fixture metadata: %v", err)
	}

	return wire
}

func assertLoadableComputedMetadata(t *testing.T, wire computedMetadataWire) {
	t.Helper()

	encoded, err := json.Marshal(wire)
	if err != nil {
		t.Fatalf("marshal variant metadata: %v", err)
	}

	if _, err := metadata.FromHasuraJSON(encoded); err != nil {
		t.Fatalf("load variant metadata: %v", err)
	}
}

func TestComputedFieldsVariantReplay(t *testing.T) {
	t.Parallel()

	var fixture struct {
		Cases    []computedVariant `json:"cases"`
		Accepted []computedVariant `json:"accepted_variants"`
	}
	if err := json.Unmarshal(
		computedFixture(t, "inconsistent_contract.json"),
		&fixture,
	); err != nil {
		t.Fatalf("decode variant expectations: %v", err)
	}

	if len(fixture.Cases) != 5 || len(fixture.Accepted) != 2 {
		t.Fatal("missing rejected or accepted variants")
	}

	for _, tc := range append(fixture.Cases, fixture.Accepted...) {
		t.Run(tc.Name, func(t *testing.T) {
			t.Parallel()

			conn := computedTestDB(t)
			wire := loadComputedMetadata(t)

			table := computedVariantTable(t, wire.Sources, tc)
			if len(computedVariantFields(t, table, "computed_fields")) == 0 {
				t.Fatal("no base computed definitions")
			}

			switch tc.Name {
			case "missing-function-add":
				checkMissingFunctionVariant(t, conn, tc)
			case "dropped-function-and-grant":
				checkDroppedFunctionVariant(t, conn, table, tc)
			case "missing-filter-reference":
				checkMissingFilterVariant(t, table, tc)
			case "table-grant-specified-manually":
				checkTableGrantVariant(t, table, tc)
			case "overloaded-function":
				checkOverloadVariant(t, conn, table, tc)
			case "alias-to-same-function":
				checkAliasVariant(t, conn, table, tc)
			case "scalar-to-source-join-key":
				checkJoinVariant(t, table, tc)
			default:
				t.Fatalf("unclassified variant %q", tc.Name)
			}

			// Each variant is a complete document, independent of integration YAML.
			assertLoadableComputedMetadata(t, wire)
		})
	}
}

// The reference accepts a second field pointing at the same function. Pin
// the independently served role SDL and values; replaying metadata and SQL
// separately does not prove that both fields survive reconciliation.
func TestComputedAliasSameFunctionServed(t *testing.T) {
	t.Parallel()

	md := computedAliasMetadata(t)
	fixtureDB := computedTestDB(t)

	pool, err := postgres.Open(t.Context(), fixtureDB.Config().ConnString())
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}

	inc := metadata.NewInconsistencies()

	connector, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatalf("build alias connector: %v", err)
	}

	t.Cleanup(connector.Close)

	if len(inc.Snapshot()) != 0 {
		t.Fatalf("alias marked inconsistent: %+v", inc.Snapshot())
	}

	assertComputedAliasRoleSchema(t, connector)

	doc, err := parser.ParseQuery(&ast.Source{Input: `query {
		cf_select_items(where:{id:{_eq:1}}) { item_label column_collision }
	}`})
	if err != nil {
		t.Fatalf("parse alias query: %v", err)
	}

	result, err := connector.Execute(t.Context(), doc.Operations[0], doc.Fragments,
		nil, "admin", nil, slog.Default())
	if err != nil {
		t.Fatalf("execute alias query: %v", err)
	}

	body, err := json.Marshal(result["cf_select_items"])
	if err != nil {
		t.Fatalf("encode result: %v", err)
	}

	var rows []struct {
		Label string `json:"item_label"`
		Alias string `json:"column_collision"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		t.Fatalf("decode result: %v", err)
	}

	if len(rows) != 1 || rows[0].Label != "first" || rows[0].Alias != "first" {
		t.Fatalf("alias and original results: %s", body)
	}
}

func computedAliasMetadata(t *testing.T) *metadata.Metadata {
	t.Helper()

	var fixture struct {
		Accepted []computedVariant `json:"accepted_variants"`
	}
	if err := json.Unmarshal(
		computedFixture(t, "inconsistent_contract.json"),
		&fixture,
	); err != nil {
		t.Fatalf("decode variants: %v", err)
	}

	wire := loadComputedMetadata(t)

	table := computedVariantTable(t, wire.Sources, computedVariant{
		Source: "cf_select", Table: "cf_select.items",
	})
	for _, tc := range fixture.Accepted {
		if tc.Name == "alias-to-same-function" {
			table["computed_fields"] = append(
				computedVariantFields(t, table, "computed_fields"),
				tc.Definition,
			)

			encoded, err := json.Marshal(wire)
			if err != nil {
				t.Fatalf("encode alias metadata: %v", err)
			}

			md, err := metadata.FromHasuraJSON(encoded)
			if err != nil {
				t.Fatalf("load alias metadata: %v", err)
			}

			return md
		}
	}

	t.Fatal("accepted alias fixture absent")

	return nil
}

func assertComputedAliasRoleSchema(t *testing.T, connector *csql.Connector) {
	t.Helper()

	schemas, err := connector.GetSchema()
	if err != nil {
		t.Fatalf("get role schemas: %v", err)
	}

	for _, tc := range []struct {
		role, field string
		present     bool
	}{
		{"admin", "item_label", true},
		{"admin", "column_collision", true},
		{"cf_reader", "item_label", true},
		{"cf_reader", "column_collision", false},
	} {
		definition := schemas[tc.role].ToAST().Definitions.ForName("cf_select_items")
		if definition == nil || (definition.Fields.ForName(tc.field) != nil) != tc.present {
			t.Errorf("%s field %s visibility = %v, want %v", tc.role, tc.field,
				definition != nil && definition.Fields.ForName(tc.field) != nil, tc.present)
		}
	}
}

func checkMissingFunctionVariant(t *testing.T, conn *pgx.Conn, tc computedVariant) {
	t.Helper()

	if tc.MetadataOperation != "pg_add_computed_field" || tc.Definition == nil ||
		tc.ErrorCode != "invalid-configuration" || tc.InconsistentKind != "computed_field" ||
		tc.SQLResult == nil {
		t.Fatal("incomplete rejected add expectation")
	}

	// The rejected add leaves the metadata unchanged and the target absent.
	if tc.Definition["name"] != "does_not_exist" {
		t.Fatal("wrong missing function")
	}

	var missing bool
	if err := conn.QueryRow(t.Context(), tc.SQL).Scan(&missing); err != nil {
		t.Fatalf("resolve missing function: %v", err)
	}

	if missing != *tc.SQLResult {
		t.Fatalf("function existence: got %v want %v", missing, *tc.SQLResult)
	}
}

func checkDroppedFunctionVariant(
	t *testing.T,
	conn *pgx.Conn,
	table map[string]any,
	tc computedVariant,
) {
	t.Helper()

	if tc.MetadataOperation != "replace_metadata" ||
		!cmp.Equal(tc.InconsistentKinds, []string{"computed_field", "select_permission"}) ||
		tc.Role != "cf_reader" || !tc.TypeAbsent || tc.Error["code"] != "validation-failed" {
		t.Fatal("incomplete dropped-function expectation")
	}

	if !containsComputedField(t, computedVariantPermission(t, table, tc.Role), "rule_visible") {
		t.Fatal("missing grant on dropped function")
	}

	if _, err := conn.Exec(t.Context(), tc.DDL); err != nil {
		t.Fatalf("drop fixture function: %v", err)
	}

	var exists bool
	if err := conn.QueryRow(t.Context(), "SELECT to_regprocedure('cf_predicates.rule_visible(cf_predicates.rules)') IS NOT NULL").
		Scan(&exists); err != nil {
		t.Fatalf("look up dropped function: %v", err)
	}

	if exists {
		t.Fatal("dropped function still exists")
	}
}

func checkMissingFilterVariant(t *testing.T, table map[string]any, tc computedVariant) {
	t.Helper()

	if tc.MetadataOperation != "replace_metadata" ||
		!cmp.Equal(tc.InconsistentKinds, []string{"select_permission"}) ||
		tc.Role != "cf_reader" || !tc.TypeAbsent || tc.Error["code"] != "validation-failed" {
		t.Fatal("incomplete filter expectation")
	}

	if _, ok := tc.PermissionFilter["missing_computed"]; !ok {
		t.Fatal("wrong missing filter")
	}

	perm := computedVariantPermission(t, table, tc.Role)

	perm["filter"] = tc.PermissionFilter
	if !cmp.Equal(perm["filter"], tc.PermissionFilter) ||
		!containsComputedField(t, perm, "rule_visible") {
		t.Fatal("filter mutation erased computed grant")
	}
}

func checkTableGrantVariant(t *testing.T, table map[string]any, tc computedVariant) {
	t.Helper()

	if tc.MetadataOperation != "replace_metadata" ||
		!cmp.Equal(tc.InconsistentKinds, []string{"select_permission"}) ||
		tc.Role != "cf_reader" || !strings.Contains(tc.Reason, "auto-derived") ||
		!cmp.Equal(tc.ComputedFields, []string{"item_tags"}) {
		t.Fatal("incomplete table grant expectation")
	}

	perm := computedVariantPermission(t, table, tc.Role)

	perm["computed_fields"] = append(
		computedArray(t, perm["computed_fields"]),
		tc.ComputedFields[0],
	)
	if !containsComputedField(t, perm, "item_tags") {
		t.Fatal("table grant was not added")
	}
}

func checkOverloadVariant(t *testing.T, conn *pgx.Conn, table map[string]any, tc computedVariant) {
	t.Helper()

	if tc.MetadataOperation != "reload_metadata" ||
		!cmp.Equal(tc.InconsistentKinds, []string{"computed_field", "select_permission"}) ||
		tc.Role != "cf_reader" || !strings.Contains(tc.Reason, "Overloaded") ||
		!containsComputedField(t, computedVariantPermission(t, table, tc.Role), "item_label") {
		t.Fatal("incomplete overloaded function expectation")
	}

	if _, err := conn.Exec(t.Context(), tc.DDL); err != nil {
		t.Fatalf("create overload: %v", err)
	}

	var count int
	if err := conn.QueryRow(t.Context(), "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname=$2", "cf_select", "item_label").
		Scan(&count); err != nil {
		t.Fatalf("count overloaded functions: %v", err)
	}

	if count != 2 {
		t.Fatalf("expected two function signatures, got %d", count)
	}
}

func checkAliasVariant(t *testing.T, conn *pgx.Conn, table map[string]any, tc computedVariant) {
	t.Helper()

	if tc.Definition == nil || len(tc.InconsistentKinds) != 0 {
		t.Fatal("incomplete accepted alias")
	}

	table["computed_fields"] = append(
		computedVariantFields(t, table, "computed_fields"),
		tc.Definition,
	)

	names := map[string]bool{}
	for _, entry := range computedVariantFields(t, table, "computed_fields") {
		names[computedString(t, computedObject(t, entry)["name"])] = true
	}

	if !names["column_collision"] || !names["item_label"] {
		t.Fatal("alias replaced original definition")
	}

	var result string
	if err := conn.QueryRow(t.Context(), tc.SQL).Scan(&result); err != nil {
		t.Fatalf("evaluate aliased function: %v", err)
	}

	if result != tc.SQLValue {
		t.Fatalf("aliased function SQL: got %q want %q", result, tc.SQLValue)
	}
}

func checkJoinVariant(t *testing.T, table map[string]any, tc computedVariant) {
	t.Helper()

	if tc.RemoteRelationship == nil || len(tc.InconsistentKinds) != 0 {
		t.Fatal("incomplete accepted remote mapping")
	}

	definition := computedObject(
		t,
		computedObject(t, tc.RemoteRelationship["definition"])["to_source"],
	)

	mapping := computedObject(t, definition["field_mapping"])
	if mapping["item_label"] != "label" || definition["source"] != "cf_select" ||
		!containsComputedField(t, computedVariantPermission(t, table, "cf_reader"), "item_label") {
		t.Fatal("join key not granted/tracked")
	}

	table["remote_relationships"] = []any{tc.RemoteRelationship}
}

func TestComputedFieldsPredicateVariantReplay(t *testing.T) {
	t.Parallel()

	wire := loadComputedMetadata(t)

	var predicate map[string]any
	if err := json.Unmarshal(
		computedFixture(t, "predicate_permissions.json"),
		&predicate,
	); err != nil {
		t.Fatalf("decode predicate variant: %v", err)
	}

	tc := computedVariant{
		Name:   "predicate-permissions",
		Source: "cf_predicates",
		Table:  "cf_predicates.rules",
	}

	table := computedVariantTable(t, wire.Sources, tc)
	if predicate["source"] != tc.Source || !cmp.Equal(predicate["table"], table["table"]) {
		t.Fatal("predicate variant not based on tracked table")
	}

	for _, kind := range []string{"select_permission", "update_permission", "insert_permission"} {
		applyPredicatePermission(t, table, predicate, kind)
	}

	if !containsComputedField(t, computedVariantPermission(t, table, "cf_reader"), "rule_visible") {
		t.Fatal("predicate fixture replaced startup grant")
	}

	assertLoadableComputedMetadata(t, wire)
}

func applyPredicatePermission(t *testing.T, table, predicate map[string]any, kind string) {
	t.Helper()

	entry := computedObject(t, predicate[kind])
	if entry["role"] != "cf_predicate_guard" {
		t.Fatalf("missing predicate role on %s", kind)
	}

	permission := computedObject(t, entry["permission"])

	var keys []string
	switch kind {
	case "select_permission":
		keys = []string{"filter"}
	case "update_permission":
		keys = []string{"filter", "check"}
	case "insert_permission":
		keys = []string{"check"}
	default:
		t.Fatalf("unknown predicate permission kind %s", kind)
	}

	for _, key := range keys {
		expression := computedObject(t, permission[key])
		if !cmp.Equal(expression["rule_visible"], map[string]any{"_eq": true}) {
			t.Fatalf("missing computed %s in %s", key, kind)
		}
	}

	key := kind + "s"

	var current []any
	if existing, ok := table[key]; ok {
		current = computedArray(t, existing)
	}

	table[key] = append(current, entry)
}

func containsComputedField(t *testing.T, permission map[string]any, field string) bool {
	t.Helper()

	for _, value := range computedArray(t, permission["computed_fields"]) {
		if value == field {
			return true
		}
	}

	return false
}
