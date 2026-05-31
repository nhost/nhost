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
				Kind:               schema.KindPostgres,
				SupportsRegex:      true,
				SupportsJSONB:      true,
				SupportsDistinctOn: true,
				SupportsFunctions:  true,
				SupportsArrays:     true,
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
				Kind:               schema.KindPostgres,
				SupportsRegex:      true,
				SupportsJSONB:      true,
				SupportsDistinctOn: true,
				SupportsFunctions:  true,
				SupportsArrays:     true,
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
				Kind:               schema.KindSQLite,
				SupportsRegex:      false,
				SupportsJSONB:      false,
				SupportsDistinctOn: false,
				SupportsFunctions:  false,
				SupportsArrays:     false,
			}, role)

			testhelpers.GoldenGraphQLSchema(
				t, "testdata/"+t.Name()+".graphqls", sdl, *updateGolden,
			)
		})
	}
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
