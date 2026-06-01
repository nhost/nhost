package schema_test

import (
	"bytes"
	"flag"
	"os"
	"regexp"
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/formatter"
)

var updateGolden = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

var testRoles = []string{ //nolint:gochecknoglobals
	"simplequeries",
	"simplequeries_aggregation",
	"queries_relationships",
	"queries_relationships_aggregation",
	"queries_relationships_enum",
	"queries_relationships_enum_no_perms",
	"mixed_permissions",
	"user",
	"admin",
}

// loadTestDDL reads the consolidated DDL for the test database.
func loadTestDDL(t *testing.T, name string) string {
	t.Helper()

	ddl, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatalf("failed to read test DDL: %v", err)
	}

	return string(ddl)
}

// introspectIsolatedPostgres creates an isolated Postgres database with the
// test schema and returns the introspected objects. Each test invocation gets
// its own database — no shared state.
func introspectIsolatedPostgres(
	t *testing.T, dbMeta *metadata.DatabaseMetadata,
) *introspection.Objects {
	t.Helper()

	pool := testdb.NewPostgres(t, loadTestDDL(t, "pg_schema.sql"))
	testDBURL := pool.Config().ConnConfig.ConnString()

	pgPool, err := postgres.Open(t.Context(), testDBURL)
	if err != nil {
		t.Fatalf("failed to open postgres pool: %v", err)
	}

	pg := postgres.NewClient(pgPool)
	t.Cleanup(func() { pg.Close() })

	objects, err := pg.Introspect(t.Context(), dbMeta)
	if err != nil {
		t.Fatalf("failed to introspect database: %v", err)
	}

	return objects
}

func TestGenerateForRole(t *testing.T) { //nolint:paralleltest
	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	objects := introspectIsolatedPostgres(t, &md.Databases[0])

	for _, role := range testRoles { //nolint:paralleltest
		t.Run(role, func(t *testing.T) {
			sdl := generateSchemaSDL(t, objects, &md.Databases[0], schema.Capabilities{
				Kind:                          schema.KindPostgres,
				SupportsRegex:                 true,
				SupportsJSONB:                 true,
				SupportsDistinctOn:            true,
				SupportsFunctions:             true,
				SupportsArrays:                true,
				SupportsVarianceAggregates:    true,
				SupportsStableVarianceOrderBy: true,
			}, role)

			testhelpers.GoldenGraphQLSchema(
				t, "testdata/"+t.Name()+".graphqls", sdl, *updateGolden,
			)
		})
	}
}

func TestGenerateForRole_NilArguments(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		objects *introspection.Objects
		md      *metadata.DatabaseMetadata
	}{
		{name: "nil metadata", objects: &introspection.Objects{}, md: nil},
		{name: "nil objects", objects: nil, md: &metadata.DatabaseMetadata{}},
		{name: "both nil", objects: nil, md: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			sch, err := schema.GenerateForRole(tt.objects, "admin", tt.md, schema.Capabilities{
				Kind:                          schema.KindPostgres,
				SupportsRegex:                 true,
				SupportsJSONB:                 true,
				SupportsDistinctOn:            true,
				SupportsFunctions:             true,
				SupportsArrays:                true,
				SupportsVarianceAggregates:    true,
				SupportsStableVarianceOrderBy: true,
			})
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if sch != nil {
				t.Errorf("expected nil schema, got %v", sch)
			}
		})
	}
}

func TestGenerateForRole_SQLite(t *testing.T) { //nolint:paralleltest
	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	sqlite.FlattenMetadata(&md.Databases[0])

	objects := testdb.IntrospectSQLite(t, loadTestDDL(t, "sqlite_schema.sql"), &md.Databases[0])

	for _, role := range testRoles { //nolint:paralleltest
		t.Run(role, func(t *testing.T) {
			sdl := generateSchemaSDL(t, objects, &md.Databases[0], schema.Capabilities{
				Kind:                          schema.KindSQLite,
				SupportsRegex:                 false,
				SupportsJSONB:                 false,
				SupportsDistinctOn:            false,
				SupportsFunctions:             false,
				SupportsArrays:                false,
				SupportsVarianceAggregates:    false,
				SupportsStableVarianceOrderBy: false,
			}, role)

			testhelpers.GoldenGraphQLSchema(
				t, "testdata/"+t.Name()+".graphqls", sdl, *updateGolden,
			)
		})
	}
}

// varianceAggregateFields is the stddev/variance aggregate-selection family that
// must be exposed only on backends with native stddev/variance aggregate
// functions. SQLite has none, so emitting them would surface an opaque runtime
// "no such function" error; the schema omits them so the request fails GraphQL
// validation cleanly instead.
var varianceAggregateFields = []string{ //nolint:gochecknoglobals
	"stddev", "stddev_pop", "stddev_samp", "var_pop", "var_samp", "variance",
}

// TestGenerateForRole_VarianceAggregateGating asserts that the stddev/variance
// aggregate-selection family is gated by Capabilities.SupportsVarianceAggregates:
// exposed (with its *_fields object types) on PostgreSQL, omitted on SQLite,
// while the native avg/sum aggregates remain on both. It is the explicit,
// self-documenting counterpart to the schema goldens, which assert the same
// thing indirectly across the whole SDL.
//
// It is a deliberate parallel of TestGenerateForRole_VarianceOrderByGating; the
// two assert distinct surfaces (aggregate-selection *_fields vs aggregate
// order_by *_order_by) gated by different capability flags, so keeping them
// separate documents which flag gates which surface, hence the dupl suppression.
//
//nolint:paralleltest,dupl // see godoc above.
func TestGenerateForRole_VarianceAggregateGating(t *testing.T) {
	// departments has a numeric (budget) column, so its aggregate_fields type
	// carries the numeric aggregate family on a variance-capable backend.
	const aggFieldsType = "departments_aggregate_fields"

	tests := []struct {
		name             string
		objects          func(t *testing.T, dbMeta *metadata.DatabaseMetadata) *introspection.Objects
		caps             schema.Capabilities
		flatten          bool
		wantVarianceFams bool
	}{
		{
			name:    "postgres exposes variance aggregates",
			objects: introspectIsolatedPostgres,
			caps: schema.Capabilities{
				Kind:                          schema.KindPostgres,
				SupportsRegex:                 true,
				SupportsJSONB:                 true,
				SupportsDistinctOn:            true,
				SupportsFunctions:             true,
				SupportsArrays:                true,
				SupportsVarianceAggregates:    true,
				SupportsStableVarianceOrderBy: true,
			},
			flatten:          false,
			wantVarianceFams: true,
		},
		{
			name: "sqlite omits variance aggregates",
			objects: func(t *testing.T, dbMeta *metadata.DatabaseMetadata) *introspection.Objects {
				t.Helper()

				return testdb.IntrospectSQLite(t, loadTestDDL(t, "sqlite_schema.sql"), dbMeta)
			},
			caps: schema.Capabilities{
				Kind:                          schema.KindSQLite,
				SupportsRegex:                 false,
				SupportsJSONB:                 false,
				SupportsDistinctOn:            false,
				SupportsFunctions:             false,
				SupportsArrays:                false,
				SupportsVarianceAggregates:    false,
				SupportsStableVarianceOrderBy: false,
			},
			flatten:          true,
			wantVarianceFams: false,
		},
	}

	for _, tt := range tests { //nolint:paralleltest
		t.Run(tt.name, func(t *testing.T) {
			// Load metadata fresh per subtest: FlattenMetadata mutates the
			// document in place, so a shared instance would leak across cases.
			md, err := metadata.FromDetect(
				t.Context(), "../../../../integration/nhost/metadata/",
			)
			if err != nil {
				t.Fatalf("failed to load metadata: %v", err)
			}

			if tt.flatten {
				sqlite.FlattenMetadata(&md.Databases[0])
			}

			objects := tt.objects(t, &md.Databases[0])

			sch, err := schema.GenerateForRole(objects, "admin", &md.Databases[0], tt.caps)
			if err != nil {
				t.Fatalf("GenerateForRole returned error: %v", err)
			}

			aggFields := objectTypeFields(t, sch, aggFieldsType)

			// avg/sum are native on every backend and must always be present.
			for _, want := range []string{"avg", "sum"} {
				if !aggFields[want] {
					t.Errorf("%s: missing native aggregate field %q", aggFieldsType, want)
				}
			}

			for _, fn := range varianceAggregateFields {
				if got := aggFields[fn]; got != tt.wantVarianceFams {
					t.Errorf(
						"%s: aggregate field %q present = %t, want %t",
						aggFieldsType, fn, got, tt.wantVarianceFams,
					)
				}

				typeName := "departments_" + fn + "_fields"
				if got := hasObjectType(sch, typeName); got != tt.wantVarianceFams {
					t.Errorf(
						"object type %q present = %t, want %t",
						typeName,
						got,
						tt.wantVarianceFams,
					)
				}
			}
		})
	}
}

// varianceOrderByFields is the stddev/variance aggregate order_by family that
// must be advertised only on backends whose stddev/variance ordering is
// numerically faithful to PostgreSQL's. SQLite is not, so the aggregate-order_by
// builder rejects these functions at runtime; the schema omits both the
// <table>_aggregate_order_by entries and their <table>_<fn>_order_by input types
// so the advertised order_by surface equals what the runtime accepts.
var varianceOrderByFields = []string{ //nolint:gochecknoglobals
	"stddev", "stddev_pop", "stddev_samp", "var_pop", "var_samp", "variance",
}

// TestGenerateForRole_VarianceOrderByGating asserts that the stddev/variance
// aggregate order_by family is gated by Capabilities.SupportsStableVarianceOrderBy:
// advertised (with its *_order_by input types and the matching fields on
// <table>_aggregate_order_by) on PostgreSQL, omitted on SQLite, while avg/sum
// order_by remain on both. It mirrors TestGenerateForRole_VarianceAggregateGating
// for the order_by surface and pins the schema/runtime contract checked by the
// aggregate-order_by builder (queries/arguments.varianceOrderByFuncs).
//
// It is a deliberate parallel of TestGenerateForRole_VarianceAggregateGating;
// the two assert distinct surfaces (aggregate order_by *_order_by vs
// aggregate-selection *_fields) gated by different capability flags, so keeping
// them separate documents which flag gates which surface, hence the dupl
// suppression.
//
//nolint:paralleltest,dupl // see godoc above.
func TestGenerateForRole_VarianceOrderByGating(t *testing.T) {
	// user_security_keys (custom type authUserSecurityKeys) has a numeric
	// (counter) column and is the target of an array relationship, so its
	// aggregate_order_by type carries the numeric order_by family.
	const (
		aggOrderByType = "authUserSecurityKeys_aggregate_order_by"
		typePrefix     = "authUserSecurityKeys_"
	)

	tests := []struct {
		name            string
		objects         func(t *testing.T, dbMeta *metadata.DatabaseMetadata) *introspection.Objects
		caps            schema.Capabilities
		flatten         bool
		wantVarianceOBs bool
	}{
		{
			name:    "postgres exposes variance order_by",
			objects: introspectIsolatedPostgres,
			caps: schema.Capabilities{
				Kind:                          schema.KindPostgres,
				SupportsRegex:                 true,
				SupportsJSONB:                 true,
				SupportsDistinctOn:            true,
				SupportsFunctions:             true,
				SupportsArrays:                true,
				SupportsVarianceAggregates:    true,
				SupportsStableVarianceOrderBy: true,
			},
			flatten:         false,
			wantVarianceOBs: true,
		},
		{
			name: "sqlite omits variance order_by",
			objects: func(t *testing.T, dbMeta *metadata.DatabaseMetadata) *introspection.Objects {
				t.Helper()

				return testdb.IntrospectSQLite(t, loadTestDDL(t, "sqlite_schema.sql"), dbMeta)
			},
			caps: schema.Capabilities{
				Kind:                          schema.KindSQLite,
				SupportsRegex:                 false,
				SupportsJSONB:                 false,
				SupportsDistinctOn:            false,
				SupportsFunctions:             false,
				SupportsArrays:                false,
				SupportsVarianceAggregates:    false,
				SupportsStableVarianceOrderBy: false,
			},
			flatten:         true,
			wantVarianceOBs: false,
		},
	}

	for _, tt := range tests { //nolint:paralleltest
		t.Run(tt.name, func(t *testing.T) {
			// Load metadata fresh per subtest: FlattenMetadata mutates the
			// document in place, so a shared instance would leak across cases.
			md, err := metadata.FromDetect(
				t.Context(), "../../../../integration/nhost/metadata/",
			)
			if err != nil {
				t.Fatalf("failed to load metadata: %v", err)
			}

			if tt.flatten {
				sqlite.FlattenMetadata(&md.Databases[0])
			}

			objects := tt.objects(t, &md.Databases[0])

			sch, err := schema.GenerateForRole(objects, "admin", &md.Databases[0], tt.caps)
			if err != nil {
				t.Fatalf("GenerateForRole returned error: %v", err)
			}

			aggOrderBy := inputObjectFields(t, sch, aggOrderByType)

			// avg/sum order_by are accepted on every backend and must always
			// be present alongside count.
			for _, want := range []string{"count", "avg", "sum"} {
				if !aggOrderBy[want] {
					t.Errorf("%s: missing order_by field %q", aggOrderByType, want)
				}
			}

			for _, fn := range varianceOrderByFields {
				if got := aggOrderBy[fn]; got != tt.wantVarianceOBs {
					t.Errorf(
						"%s: order_by field %q present = %t, want %t",
						aggOrderByType, fn, got, tt.wantVarianceOBs,
					)
				}

				typeName := typePrefix + fn + "_order_by"
				if got := hasInputType(sch, typeName); got != tt.wantVarianceOBs {
					t.Errorf(
						"input type %q present = %t, want %t",
						typeName, got, tt.wantVarianceOBs,
					)
				}
			}
		})
	}
}

// objectTypeFields returns the field-name set of the named object type in sch,
// failing the test if the type is absent.
func objectTypeFields(t *testing.T, sch *graph.Schema, typeName string) map[string]bool {
	t.Helper()

	for _, ot := range sch.Types {
		if ot.Name != typeName {
			continue
		}

		fields := make(map[string]bool, len(ot.Fields))
		for _, f := range ot.Fields {
			fields[f.Name] = true
		}

		return fields
	}

	t.Fatalf("object type %q not found in generated schema", typeName)

	return nil
}

// hasObjectType reports whether sch defines an object type with the given name.
func hasObjectType(sch *graph.Schema, typeName string) bool {
	for _, ot := range sch.Types {
		if ot.Name == typeName {
			return true
		}
	}

	return false
}

// inputObjectFields returns the field-name set of the named input object type in
// sch, failing the test if the type is absent.
func inputObjectFields(t *testing.T, sch *graph.Schema, typeName string) map[string]bool {
	t.Helper()

	for _, in := range sch.Inputs {
		if in.Name != typeName {
			continue
		}

		fields := make(map[string]bool, len(in.Fields))
		for _, f := range in.Fields {
			fields[f.Name] = true
		}

		return fields
	}

	t.Fatalf("input object type %q not found in generated schema", typeName)

	return nil
}

// hasInputType reports whether sch defines an input object type with the given name.
func hasInputType(sch *graph.Schema, typeName string) bool {
	for _, in := range sch.Inputs {
		if in.Name == typeName {
			return true
		}
	}

	return false
}

// TestSQLiteFixtureCoversMetadataTables guards against drift between the shared
// integration metadata (integration/nhost/metadata/) and the hand-maintained
// DDL fixture the SQLite tests introspect (testdata/sqlite_schema.sql).
//
// The two files are maintained independently: the metadata declares which
// tables are tracked, while the fixture declares which tables introspection can
// actually see. When a table is added to the metadata (e.g. after an auth
// version bump introduces new tables) but not mirrored into the fixture, schema
// generation emits a relationship field whose target type is never created
// ("Undefined type ...") and query building fails with "unable to find table
// ... in introspection objects". Both failures are cryptic and far removed from
// the cause. This test fails fast instead, naming the table that is tracked in
// metadata but missing from the fixture.
func TestSQLiteFixtureCoversMetadataTables(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	sqlite.FlattenMetadata(&md.Databases[0])

	objects := testdb.IntrospectSQLite(
		t, loadTestDDL(t, "sqlite_schema.sql"), &md.Databases[0],
	)

	for _, tableMeta := range md.Databases[0].Tables {
		if _, ok := objects.GetTable(tableMeta.Table.Schema, tableMeta.Table.Name); !ok {
			t.Errorf(
				"metadata tracks table %q but testdata/sqlite_schema.sql has no matching "+
					"table; add it to the SQLite and Postgres fixtures and regenerate goldens",
				tableMeta.Table.Name,
			)
		}
	}
}

// createFunctionRE matches a top-level CREATE FUNCTION / CREATE OR REPLACE
// FUNCTION statement in the Postgres DDL fixture and captures the
// schema-qualified function name (e.g. "public.search_news"). It mirrors the
// fixture's hand-written style: every tracked function is declared
// schema-qualified with the name immediately followed by its argument list.
var createFunctionRE = regexp.MustCompile(
	`(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)\s*\(`,
)

// fixtureFunctionNamesAtPath extracts the set of schema-qualified function
// names defined in the Postgres DDL fixture at relpath by scanning its CREATE
// FUNCTION statements. The path is relative to the test's working directory
// (the package dir), matching loadTestDDL's file-only access: no database is
// required.
func fixtureFunctionNamesAtPath(t *testing.T, relpath string) map[string]struct{} {
	t.Helper()

	ddl, err := os.ReadFile(relpath)
	if err != nil {
		t.Fatalf("failed to read test DDL %q: %v", relpath, err)
	}

	defined := make(map[string]struct{})
	for _, m := range createFunctionRE.FindAllStringSubmatch(string(ddl), -1) {
		defined[m[1]] = struct{}{}
	}

	return defined
}

// TestPgFixtureCoversMetadataFunctions guards against drift between the shared
// integration metadata (integration/nhost/metadata/) and the four
// hand-maintained Postgres DDL fixtures the SQL tests introspect. The same
// function definitions are independently maintained in all four:
//
//   - testdata/pg_schema.sql               (schema package)
//   - ../queries/testdata/pg_schema.sql    (queries package)
//   - ../../../testdata/pg_schema.sql      (connector package)
//   - ../../postgres/testdata/pg_schema.sql (postgres driver package)
//
// It is the function-level counterpart to TestSQLiteFixtureCoversMetadataTables;
// functions are a Postgres-only concept (SQLite sets SupportsFunctions=false),
// so the fixtures under test are the Postgres ones.
//
// The files are maintained independently: the metadata declares which functions
// are tracked, while each fixture declares which functions Postgres
// introspection can actually see. introspectFunctions silently elides a tracked
// function with no matching pg_proc row, so a function present in metadata but
// missing from a fixture never reaches that fixture's connector/schema/
// introspection goldens — its argument contract is silently dropped from
// coverage instead of failing. Keeping the four copies in sync by hand has
// already caused real data loss, so this test fails fast instead, naming both
// the function that is tracked in metadata and the fixture that is missing it.
//
// It reads the fixture and metadata files only and needs no live database.
func TestPgFixtureCoversMetadataFunctions(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromDetect(t.Context(), "../../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	fixtures := []struct {
		label string
		path  string
	}{
		{label: "schema", path: "testdata/pg_schema.sql"},
		{label: "queries", path: "../queries/testdata/pg_schema.sql"},
		{label: "connector", path: "../../../testdata/pg_schema.sql"},
		{label: "postgres", path: "../../postgres/testdata/pg_schema.sql"},
	}

	for _, fixture := range fixtures {
		t.Run(fixture.label, func(t *testing.T) {
			t.Parallel()

			defined := fixtureFunctionNamesAtPath(t, fixture.path)

			var missing []string

			for _, fnMeta := range md.Databases[0].Functions {
				key := fnMeta.Function.Schema + "." + fnMeta.Function.Name
				if _, ok := defined[key]; !ok {
					missing = append(missing, key)
				}
			}

			slices.Sort(missing)

			for _, key := range missing {
				t.Errorf(
					"metadata tracks function %q but %s has no matching CREATE FUNCTION; "+
						"add it and regenerate goldens",
					key, fixture.path,
				)
			}
		})
	}
}

func generateSchemaSDL(
	t *testing.T,
	objects *introspection.Objects,
	dbMeta *metadata.DatabaseMetadata,
	caps schema.Capabilities,
	role string,
) string {
	t.Helper()

	sch, err := schema.GenerateForRole(objects, role, dbMeta, caps)
	if err != nil {
		t.Fatalf("failed to generate schema for role %q: %v", role, err)
	}

	if sch == nil {
		return ""
	}

	schemaDoc := sch.ToAST()

	var buf bytes.Buffer

	f := formatter.NewFormatter(&buf, formatter.WithIndent("  "))
	f.FormatSchemaDocument(schemaDoc)

	return buf.String()
}
