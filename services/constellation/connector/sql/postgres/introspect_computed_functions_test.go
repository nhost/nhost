package postgres_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type computedExpectation struct {
	table      metadata.TableSource
	name       string
	fnSchema   string
	fnName     string
	rowIndex   int
	argTypes   []introspection.PostgreSQLType
	argModes   []string
	defaults   []bool
	returnType introspection.PostgreSQLType
	set        bool
	volatility introspection.Volatility
	reason     string
}

func TestIntrospectComputedFunctions(
	t *testing.T,
) {
	fixture := filepath.Join("..", "..", "..", "integration", "nhost")

	ddl, err := os.ReadFile(
		filepath.Join(fixture, "migrations", "default", "1790001000000_computed_fields", "up.sql"),
	)
	if err != nil {
		t.Fatalf("reading computed migration: %v", err)
	}

	seed, err := os.ReadFile(filepath.Join(fixture, "seeds", "default", "40-computed-fields.sql"))
	if err != nil {
		t.Fatalf("reading computed seed: %v", err)
	}

	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	_, err = pool.Exec(t.Context(), `
		CREATE FUNCTION cf_select.item_out(IN item cf_select.items, OUT result text)
		LANGUAGE sql STABLE AS $$ SELECT item.label $$;
		CREATE FUNCTION cf_select.item_inout(INOUT item cf_select.items)
		LANGUAGE sql STABLE AS $$ SELECT item $$;
		CREATE FUNCTION cf_select.item_immutable(item cf_select.items)
		RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT item.label $$;
		CREATE FUNCTION cf_select.item_volatile(item cf_select.items)
		RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT item.label $$;
		CREATE SCHEMA cf_shadow;
		CREATE TYPE cf_shadow.items AS (id integer);
		CREATE FUNCTION cf_select.item_shadow(item cf_shadow.items)
		RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'shadow'::text $$;
	`)
	if err != nil {
		t.Fatalf("creating additional signature fixtures: %v", err)
	}

	clientPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("opening postgres driver: %v", err)
	}

	client := postgres.NewClient(clientPool)
	t.Cleanup(client.Close)

	fixtureMetadata, err := os.ReadFile(
		filepath.Join(
			"..",
			"..",
			"..",
			"integration",
			"computedfields",
			"testdata",
			"metadata.json",
		),
	)
	if err != nil {
		t.Fatalf("reading computed metadata: %v", err)
	}

	parsed, err := metadata.FromHasuraJSON(fixtureMetadata)
	if err != nil {
		t.Fatalf("decoding computed metadata: %v", err)
	}

	item := metadata.TableSource{Schema: "cf_select", Name: "items"}
	rules := metadata.TableSource{Schema: "cf_predicates", Name: "rules"}
	field := func(name, fn, rowArg string) metadata.ComputedField {
		return metadata.ComputedField{
			Name: name,
			Definition: metadata.ComputedFieldDefinition{
				Function:      metadata.FunctionSource{Schema: "cf_select", Name: fn},
				TableArgument: rowArg,
			},
		}
	}

	md := &metadata.DatabaseMetadata{
		Functions: []metadata.FunctionMetadata{
			{Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_tags"}},
		},
	}
	for _, source := range parsed.Databases {
		md.Tables = append(md.Tables, source.Tables...)
	}

	for i := range md.Tables {
		if md.Tables[i].Table != item {
			continue
		}

		md.Tables[i].ComputedFields = append(md.Tables[i].ComputedFields,
			field("label_alias", "item_label", ""), field("missing", "absent", ""),
			field("wrong_row", "item_second", "multiplier"),
			field("missing_row", "item_second", "nonexistent"),
			field("out", "item_out", ""), field("inout", "item_inout", ""),
			field("immutable", "item_immutable", ""), field("volatile", "item_volatile", ""),
			field("shadow", "item_shadow", ""),
		)
	}

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("introspecting computed fixture: %v", err)
	}

	assertTrackedRootUnchanged(t, objects)

	tests := computedFixtureExpectations(item, rules)
	// The first six expectations cover every field in the checked-in Phase 2
	// inventory; extra cases below exercise invalid and unusual signatures.
	assertFixtureSignaturesCovered(t, parsed, tests[:6])

	t.Run("signatures", func(t *testing.T) {
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

				assertExpectedComputedLookup(t, objects, tt, item)
			})
		}
	})

	assertComputedOverloadAndDrop(t, pool, client, md, item, rules)
}

// The first six cases mirror the checked-in Phase 2 inventory; the rest
// exercise additional invalid and unusual signatures against the same DDL.
func computedFixtureExpectations(item, rules metadata.TableSource) []computedExpectation {
	return []computedExpectation{
		{
			table:      item,
			name:       "item_label",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
		},
		{
			table:    item,
			name:     "item_score",
			rowIndex: 0,
			argTypes: []introspection.PostgreSQLType{
				{Schema: "cf_select", Name: "items"},
				{Schema: "pg_catalog", Name: "int4"},
			},
			argModes:   []string{"i", "i"},
			defaults:   []bool{false, true},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "numeric"},
		},
		{
			table:    item,
			name:     "item_second",
			rowIndex: 1,
			argTypes: []introspection.PostgreSQLType{
				{Schema: "pg_catalog", Name: "int4"},
				{Schema: "cf_select", Name: "items"},
			},
			argModes:   []string{"i", "i"},
			defaults:   []bool{false, false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "numeric"},
		},
		{
			table:      item,
			name:       "item_tags",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "cf_select", Name: "tags"},
			set:        true,
		},
		{
			table:      item,
			name:       "item_payload",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "jsonb"},
		},
		{
			table:      rules,
			name:       "rule_visible",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_predicates", Name: "rules"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "bool"},
		},
		{
			name:       "label_alias",
			fnName:     "item_label",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
		},
		{name: "missing", reason: "function not found"},
		{name: "wrong_row", reason: "row argument has wrong table type"},
		{name: "shadow", reason: "row argument has wrong table type"},
		{name: "missing_row", reason: "row argument not found"},
		{
			name:     "out",
			fnName:   "item_out",
			rowIndex: 0,
			argTypes: []introspection.PostgreSQLType{
				{Schema: "cf_select", Name: "items"},
				{Schema: "pg_catalog", Name: "text"},
			},
			argModes:   []string{"i", "o"},
			defaults:   []bool{false, false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
		},
		{name: "inout", reason: "row argument must be IN"},
		{
			name:       "immutable",
			fnName:     "item_immutable",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
			volatility: introspection.VolatilityImmutable,
		},
		{
			name:       "volatile",
			fnName:     "item_volatile",
			rowIndex:   0,
			argTypes:   []introspection.PostgreSQLType{{Schema: "cf_select", Name: "items"}},
			argModes:   []string{"i"},
			defaults:   []bool{false},
			returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
			volatility: introspection.VolatilityVolatile,
		},
	}
}

func TestIntrospectComputedFunctionDefaultSchema(t *testing.T) {
	t.Parallel()

	pool := testdb.NewPostgres(t, `
		CREATE TABLE public.items (id integer PRIMARY KEY, label text);
		CREATE FUNCTION public.item_label(item public.items)
		RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label $$;
		CREATE SCHEMA cf_shadow;
		CREATE FUNCTION cf_shadow.other_only(item public.items)
		RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label $$;
	`, "")

	clientPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("opening postgres driver: %v", err)
	}

	client := postgres.NewClient(clientPool)
	t.Cleanup(client.Close)

	// Decode through the Hasura wire form: both the bare string and object
	// leave Function.Schema empty in native metadata.
	parsed, err := metadata.FromHasuraJSON([]byte(`{
		"version": 3,
		"sources": [{"name": "cf", "kind": "postgres", "tables": [{
			"table": {"schema": "public", "name": "items"},
			"computed_fields": [
				{"name": "bare", "definition": {"function": "item_label"}},
				{"name": "object", "definition": {"function": {"name": "item_label"}}},
				{"name": "other_schema_only", "definition": {"function": "other_only"}}
			]
		}]}]
	}`))
	if err != nil {
		t.Fatalf("decoding schema-less function references: %v", err)
	}

	objects, err := client.Introspect(t.Context(), &parsed.Databases[0])
	if err != nil {
		t.Fatalf("introspecting schema-less function references: %v", err)
	}

	for _, tt := range []struct {
		name   string
		reason string
	}{
		{name: "bare"},
		{name: "object"},
		{name: "other_schema_only", reason: "function not found"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, found := objects.GetComputedFunction("public", "items", tt.name)
			if !found || got.Reason != tt.reason {
				t.Fatalf("lookup = %+v, found %v; want reason %q", got, found, tt.reason)
			}

			if tt.reason != "" {
				if got.Function != nil {
					t.Fatalf("schema-less reference resolved in other schema: %+v", got.Function)
				}

				return
			}

			assertComputedSignature(t, got, computedExpectation{
				fnSchema: "public", fnName: "item_label", rowIndex: 0,
				argTypes: []introspection.PostgreSQLType{{Schema: "public", Name: "items"}},
				argModes: []string{"i"}, defaults: []bool{false},
				returnType: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "text"},
			})
		})
	}
}

func assertExpectedComputedLookup(
	t *testing.T,
	objects *introspection.Objects,
	tt computedExpectation,
	defaultTable metadata.TableSource,
) {
	t.Helper()

	table := tt.table
	if table == (metadata.TableSource{}) {
		table = defaultTable
	}

	got, ok := objects.GetComputedFunction(table.Schema, table.Name, tt.name)
	if !ok {
		t.Fatal("missing field lookup")
	}

	if tt.reason == "" && tt.fnName == "" {
		tt.fnName = tt.name
	}

	if tt.reason == "" && tt.fnSchema == "" {
		tt.fnSchema = table.Schema
	}

	assertComputedSignature(t, got, tt)
}

func assertComputedOverloadAndDrop(
	t *testing.T, pool *pgxpool.Pool, client *postgres.Client, md *metadata.DatabaseMetadata,
	item, rules metadata.TableSource,
) {
	t.Helper()

	// A second overload invalidates only fields using that function, including
	// aliases; the unaffected computed signatures remain available.
	_, err := pool.Exec(
		t.Context(),
		`CREATE FUNCTION cf_select.item_label(item cf_select.items, suffix text DEFAULT '!')
		RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label || suffix $$`,
	)
	if err != nil {
		t.Fatalf("creating overload: %v", err)
	}

	objects, err := client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("introspecting overload: %v", err)
	}

	for _, name := range []string{"item_label", "label_alias"} {
		label, _ := objects.GetComputedFunction(item.Schema, item.Name, name)
		if !strings.Contains(label.Reason, "overloaded") || label.Function != nil {
			t.Errorf("overload %s = %+v", name, label)
		}
	}

	score, _ := objects.GetComputedFunction(item.Schema, item.Name, "item_score")
	if score.Function == nil || score.Reason != "" {
		t.Errorf("unaffected score = %+v", score)
	}

	_, err = pool.Exec(t.Context(), `DROP FUNCTION cf_predicates.rule_visible(cf_predicates.rules)`)
	if err != nil {
		t.Fatalf("dropping rule_visible: %v", err)
	}

	objects, err = client.Introspect(t.Context(), md)
	if err != nil {
		t.Fatalf("introspecting dropped function: %v", err)
	}

	missingRule, ok := objects.GetComputedFunction(rules.Schema, rules.Name, "rule_visible")
	if !ok || missingRule.Function != nil || missingRule.Reason != "function not found" {
		t.Errorf("dropped rule_visible = %+v, found %v", missingRule, ok)
	}

	score, _ = objects.GetComputedFunction(item.Schema, item.Name, "item_score")
	if score.Function == nil || score.Reason != "" {
		t.Errorf("unaffected score after drop = %+v", score)
	}
}

func assertFixtureSignaturesCovered(
	t *testing.T, parsed *metadata.Metadata, expected []computedExpectation,
) {
	t.Helper()

	type key struct {
		table metadata.TableSource
		field string
	}

	remaining := make(map[key]bool, len(expected))
	for _, tt := range expected {
		if tt.table == (metadata.TableSource{}) {
			t.Fatal("fixture expectation missing table identity")
		}

		remaining[key{table: tt.table, field: tt.name}] = true
	}

	for _, source := range parsed.Databases {
		for _, table := range source.Tables {
			for _, field := range table.ComputedFields {
				entry := key{table: table.Table, field: field.Name}
				if !remaining[entry] || field.DecodeError != "" {
					t.Errorf("unclassified or invalid fixture signature: %+v", entry)
				}

				delete(remaining, entry)
			}
		}
	}

	for entry := range remaining {
		t.Errorf("expected signature absent from inventory: %+v", entry)
	}
}

func assertTrackedRootUnchanged(t *testing.T, objects *introspection.Objects) {
	t.Helper()

	if len(objects.Functions) != 1 {
		t.Fatalf("computed fields changed the tracked root-function set: %v", objects.Functions)
	}

	root, ok := objects.GetFunction("cf_select", "item_tags")
	if !ok || !root.ReturnType.IsTableType() || !root.ReturnType.IsSetOf ||
		root.ReturnType.TableName != "tags" || len(root.Arguments) != 1 || root.Arguments[0].Type != "items" {
		t.Fatalf("tracked root-function contract changed: %+v", root)
	}
}

func assertComputedSignature(
	t *testing.T,
	got introspection.ComputedFunctionLookup,
	tt computedExpectation,
) {
	t.Helper()

	if got.Reason != tt.reason {
		t.Fatalf("reason = %q, want %q", got.Reason, tt.reason)
	}

	if tt.reason != "" {
		if got.Function != nil {
			t.Fatal("invalid signature resolved")
		}

		return
	}

	fn := got.Function

	volatility := tt.volatility
	if volatility == "" {
		volatility = introspection.VolatilityStable
	}

	if fn == nil {
		t.Fatal("signature did not resolve")
	}

	assertComputedIdentity(t, fn, tt, volatility)

	if fn.ReturnType.Schema != tt.returnType.Schema || fn.ReturnType.Name != tt.returnType.Name ||
		fn.ReturnType.OID == 0 {
		t.Errorf("return type = %+v, want %+v", fn.ReturnType, tt.returnType)
	}

	if tt.set && fn.ReturnRelOID == 0 {
		t.Error("table return has no relation OID")
	}

	assertComputedArguments(t, fn.Arguments, tt)
}

func assertComputedIdentity(
	t *testing.T, fn *introspection.ComputedFunction, tt computedExpectation,
	volatility introspection.Volatility,
) {
	t.Helper()

	if fn.OID == 0 || fn.Schema != tt.fnSchema || fn.Name != tt.fnName ||
		fn.RowArgument != tt.rowIndex || fn.ReturnSet != tt.set || fn.Volatility != volatility {
		t.Errorf("unexpected signature: %+v", fn)
	}
}

func assertComputedArguments(
	t *testing.T,
	args []introspection.ComputedFunctionArgument,
	tt computedExpectation,
) {
	t.Helper()

	if len(args) != len(tt.argTypes) {
		t.Fatalf("arguments = %+v", args)
	}

	for i, arg := range args {
		if arg.Type.Schema != tt.argTypes[i].Schema || arg.Type.Name != tt.argTypes[i].Name ||
			arg.Type.OID == 0 || arg.Mode != tt.argModes[i] || arg.HasDefault != tt.defaults[i] || arg.Position != i {
			t.Errorf(
				"argument %d = %+v, want type %+v, mode %q, default %v",
				i,
				arg,
				tt.argTypes[i],
				tt.argModes[i],
				tt.defaults[i],
			)
		}
	}
}
