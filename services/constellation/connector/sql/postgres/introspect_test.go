package postgres_test

import (
	"context"
	"errors"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres/mock"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/internal/lib/testhelpers"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var updateGolden = flag.Bool("update", false, "update golden files") //nolint:gochecknoglobals

func TestIntrospect(t *testing.T) { //nolint:paralleltest
	cases := []struct {
		name string
	}{
		{
			name: "success",
		},
	}

	md, err := metadata.FromDetect(t.Context(), "../../../integration/nhost/metadata/")
	if err != nil {
		t.Fatalf("failed to load metadata: %v", err)
	}

	ddl, err := os.ReadFile("testdata/pg_schema.sql")
	if err != nil {
		t.Fatalf("failed to read test DDL: %v", err)
	}

	pool := testdb.NewPostgres(t, string(ddl))

	pgPool, err := postgres.Open(t.Context(), pool.Config().ConnConfig.ConnString())
	if err != nil {
		t.Fatalf("failed to open postgres pool: %v", err)
	}

	pg := postgres.NewClient(pgPool)
	t.Cleanup(func() { pg.Close() })

	for _, tc := range cases { //nolint:paralleltest
		t.Run(tc.name, func(t *testing.T) {
			got, err := pg.Introspect(t.Context(), &md.Databases[0])
			if err != nil {
				t.Fatalf("failed to get objects: %v", err)
			}

			testhelpers.GoldenJSON(
				t, filepath.Join("testdata", t.Name()+".golden.json"), got, *updateGolden,
			)
		})
	}
}

func TestIntrospect_SchemaQueryError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)

	pool.EXPECT().
		Query(gomock.Any(), gomock.Any()).
		Return(nil, errors.New("schema query failed"))

	client := postgres.NewClient(pool)

	_, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
		Name: "default",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestIntrospect_EmptyDatabase(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)
	rows := emptyRows(ctrl)

	pool.EXPECT().Query(gomock.Any(), gomock.Any()).Return(rows, nil)

	client := postgres.NewClient(pool)

	objs, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
		Name: "default",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(objs.Schemas) != 0 {
		t.Errorf("expected 0 schemas, got %d", len(objs.Schemas))
	}
}

// columnScan mirrors the row layout produced by the populateTableColumns
// query, in scan order.
type columnScan struct {
	tableName      string
	columnName     string
	typeName       string
	isNullable     string
	isGenerated    bool
	isArray        bool
	supportsMinMax bool
	supportsInc    bool
	supportsAgg    bool
	columnDefault  *string
	columnComment  *string
}

func TestIntrospect_ColumnScanning(t *testing.T) { //nolint:gocognit,cyclop
	t.Parallel()

	def := "1"
	comment := "id column"

	tests := []struct {
		name     string
		columns  []columnScan
		validate func(t *testing.T, tables map[string]*introspection.Table)
	}{
		{
			name: "regular column copies supports flags as-is",
			columns: []columnScan{{
				tableName:      "users",
				columnName:     "id",
				typeName:       "int4",
				isNullable:     "NO",
				isGenerated:    false,
				isArray:        false,
				supportsMinMax: true,
				supportsInc:    true,
				supportsAgg:    true,
				columnDefault:  &def,
				columnComment:  &comment,
			}},
			validate: func(t *testing.T, tables map[string]*introspection.Table) {
				t.Helper()

				cols := tables["users"].Columns
				if len(cols) != 1 {
					t.Fatalf("expected 1 column, got %d", len(cols))
				}

				c := cols[0]
				if c.IsNullable || !c.SupportsMinMax || !c.SupportsInc || !c.SupportsAgg {
					t.Errorf("unexpected column flags: %+v", c)
				}

				if c.Default == nil || *c.Default != def {
					t.Errorf("default = %v, want %q", c.Default, def)
				}

				if c.Comment == nil || *c.Comment != comment {
					t.Errorf("comment = %v, want %q", c.Comment, comment)
				}
			},
		},
		{
			name: "array column zeroes supports flags",
			columns: []columnScan{{
				tableName:      "users",
				columnName:     "tags",
				typeName:       "text",
				isNullable:     "YES",
				isArray:        true,
				supportsMinMax: true,
				supportsInc:    true,
				supportsAgg:    true,
			}},
			validate: func(t *testing.T, tables map[string]*introspection.Table) {
				t.Helper()

				c := tables["users"].Columns[0]
				if !c.IsArray {
					t.Error("expected IsArray=true")
				}

				if c.SupportsMinMax || c.SupportsInc || c.SupportsAgg {
					t.Errorf("array column should have zeroed supports flags, got %+v", c)
				}

				if !c.IsNullable {
					t.Error("expected IsNullable=true for is_nullable=YES")
				}
			},
		},
		{
			name: "multiple columns in one table",
			columns: []columnScan{
				{tableName: "users", columnName: "id", typeName: "int4", isNullable: "NO"},
				{tableName: "users", columnName: "email", typeName: "text", isNullable: "NO"},
			},
			validate: func(t *testing.T, tables map[string]*introspection.Table) {
				t.Helper()

				cols := tables["users"].Columns
				if len(cols) != 2 {
					t.Fatalf("expected 2 columns, got %d", len(cols))
				}

				if cols[0].Name != "id" || cols[1].Name != "email" {
					t.Errorf("column order wrong: %+v", cols)
				}
			},
		},
		{
			name: "multiple tables produce separate entries",
			columns: []columnScan{
				{tableName: "users", columnName: "id", typeName: "int4", isNullable: "NO"},
				{tableName: "posts", columnName: "id", typeName: "int4", isNullable: "NO"},
			},
			validate: func(t *testing.T, tables map[string]*introspection.Table) {
				t.Helper()

				if len(tables) != 2 {
					t.Fatalf("expected 2 tables, got %d", len(tables))
				}

				if tables["users"] == nil || tables["posts"] == nil {
					t.Errorf("expected both users and posts, got %v", tables)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)

			wireSchemaWithColumns(t, ctrl, pool, "public", tt.columns)

			client := postgres.NewClient(pool)

			objs, err := client.Introspect(
				t.Context(),
				&metadata.DatabaseMetadata{Name: "default"},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			schema := objs.Schemas["public"]
			if schema == nil {
				t.Fatal("expected schema \"public\" in result")
			}

			tt.validate(t, schema.Tables)
		})
	}
}

// wireSchemaWithColumns programs `pool` so a call to Introspect issues:
//
//  1. one getSchemas query that returns {schemaName},
//  2. one populateTableColumns query that returns `columns`,
//  3. empty foreign-keys / unique-constraints queries,
//  4. per-table empty primary-keys query and null table-comment row.
//
// Subsequent dispatching is by SQL substring, which is good enough to route
// each helper to the right canned response.
func wireSchemaWithColumns(
	t *testing.T,
	ctrl *gomock.Controller,
	pool *mock.MockPool,
	schemaName string,
	columns []columnScan,
) {
	t.Helper()

	tables := tableNames(columns)

	pool.EXPECT().
		Query(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, sql string, _ ...any) (postgres.Rows, error) {
			switch {
			case strings.Contains(sql, "information_schema.schemata"):
				return singleStringRows(ctrl, schemaName), nil
			case strings.Contains(sql, "type_aggregates"):
				return columnRowsMock(t, ctrl, columns), nil
			case strings.Contains(sql, "pg_index"):
				return emptyRows(ctrl), nil
			default:
				return emptyRows(ctrl), nil
			}
		}).
		AnyTimes()

	pool.EXPECT().
		QueryRow(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, _ string, _ ...any) postgres.Row {
			return nullRow(ctrl)
		}).
		Times(len(tables))
}

func tableNames(columns []columnScan) []string {
	seen := make(map[string]struct{})

	var names []string

	for _, c := range columns {
		if _, ok := seen[c.tableName]; ok {
			continue
		}

		seen[c.tableName] = struct{}{}
		names = append(names, c.tableName)
	}

	return names
}

func emptyRows(ctrl *gomock.Controller) *mock.MockRows {
	rows := mock.NewMockRows(ctrl)
	rows.EXPECT().Next().Return(false)
	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()

	return rows
}

func singleStringRows(ctrl *gomock.Controller, value string) *mock.MockRows {
	rows := mock.NewMockRows(ctrl)
	call := 0
	rows.EXPECT().Next().DoAndReturn(func() bool {
		call++
		return call == 1
	}).Times(2)
	rows.EXPECT().Scan(gomock.Any()).DoAndReturn(func(dest ...any) error {
		ptr, ok := dest[0].(*string)
		if !ok {
			return errors.New("expected *string dest")
		}

		*ptr = value

		return nil
	})
	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()

	return rows
}

// nullRow scans nothing (leaves dest pointers at their zero value) and
// returns no error — used as the table-comment row that population code
// dereferences as a nullable *string.
func nullRow(ctrl *gomock.Controller) *mock.MockRow {
	row := mock.NewMockRow(ctrl)
	row.EXPECT().Scan(gomock.Any()).Return(nil)

	return row
}

// columnRowsMock returns a MockRows that yields one row per columnScan.
func columnRowsMock(
	t *testing.T, ctrl *gomock.Controller, columns []columnScan,
) *mock.MockRows {
	t.Helper()

	rows := mock.NewMockRows(ctrl)
	call := 0

	rows.EXPECT().Next().DoAndReturn(func() bool {
		call++
		return call <= len(columns)
	}).Times(len(columns) + 1)

	rows.EXPECT().Scan(gomock.Any()).DoAndReturn(func(dest ...any) error {
		row := columns[call-1]
		fillColumnScan(t, dest, row)

		return nil
	}).Times(len(columns))

	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()

	return rows
}

func fillColumnScan(t *testing.T, dest []any, row columnScan) {
	t.Helper()

	if len(dest) != 11 {
		t.Fatalf("expected 11 scan destinations, got %d", len(dest))
	}

	assignDest(t, dest[0], row.tableName)
	assignDest(t, dest[1], row.columnName)
	assignDest(t, dest[2], row.typeName)
	assignDest(t, dest[3], row.isNullable)
	assignDest(t, dest[4], row.isGenerated)
	assignDest(t, dest[5], row.isArray)
	assignDest(t, dest[6], row.supportsMinMax)
	assignDest(t, dest[7], row.supportsInc)
	assignDest(t, dest[8], row.supportsAgg)
	assignDest(t, dest[9], row.columnDefault)
	assignDest(t, dest[10], row.columnComment)
}

func assignDest[T any](t *testing.T, dst any, v T) {
	t.Helper()

	ptr, ok := dst.(*T)
	if !ok {
		t.Fatalf("scan destination type mismatch: got %T, want *%T", dst, v)
	}

	*ptr = v
}

// TestIntrospect_DownstreamErrors covers the three failure points past
// schema discovery: the per-schema introspection, enum-value introspection,
// and function introspection. Each case fails a different call in turn and
// asserts the wrap-message context survives.
func TestIntrospect_DownstreamErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		wireMocks func(t *testing.T, ctrl *gomock.Controller, pool *mock.MockPool)
		dbMeta    *metadata.DatabaseMetadata
		wantSub   string
	}{
		{
			name: "per-schema introspection fails after schema discovery",
			wireMocks: func(t *testing.T, ctrl *gomock.Controller, pool *mock.MockPool) {
				t.Helper()

				pool.EXPECT().
					Query(gomock.Any(), gomock.Any()).
					DoAndReturn(
						func(_ context.Context, sql string, _ ...any) (postgres.Rows, error) {
							if strings.Contains(sql, "information_schema.schemata") {
								return singleStringRows(ctrl, "public"), nil
							}

							return nil, errors.New("table query exploded")
						}).
					AnyTimes()
				pool.EXPECT().
					Query(gomock.Any(), gomock.Any(), gomock.Any()).
					Return(nil, errors.New("table query exploded")).
					AnyTimes()
			},
			dbMeta:  &metadata.DatabaseMetadata{Name: "default"},
			wantSub: "failed to introspect schema public",
		},
		{
			name: "enum-value introspection fails",
			wireMocks: func(t *testing.T, ctrl *gomock.Controller, pool *mock.MockPool) {
				t.Helper()

				wireSchemaWithColumns(t, ctrl, pool, "public", []columnScan{
					{
						tableName:  "status",
						columnName: "value",
						typeName:   "text",
						isNullable: "NO",
					},
				})
			},
			dbMeta: &metadata.DatabaseMetadata{
				Name: "default",
				Tables: []metadata.TableMetadata{
					{
						Table:  metadata.TableSource{Schema: "public", Name: "status"},
						IsEnum: true,
					},
				},
			},
			// EnumColumns rejects the no-PK table — surfaced via the
			// "introspecting enum values" wrap on line 38.
			wantSub: "introspecting enum values",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)

			tt.wireMocks(t, ctrl, pool)

			client := postgres.NewClient(pool)

			_, err := client.Introspect(t.Context(), tt.dbMeta)
			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if !strings.Contains(err.Error(), tt.wantSub) {
				t.Errorf(
					"error %q does not contain wrap context %q",
					err.Error(), tt.wantSub,
				)
			}
		})
	}
}

// TestIntrospect_FunctionsError exercises the "introspecting functions" wrap
// at introspect.go:43 by giving Introspect a function entry whose pg_proc
// query returns an error.
func TestIntrospect_FunctionsError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	pool := mock.NewMockPool(ctrl)

	// Schema discovery returns no schemas (so no per-schema work), but the
	// function entry triggers introspectFunctions which calls QueryRow on
	// pg_proc. Returning a failing row drives the wrap.
	pool.EXPECT().
		Query(gomock.Any(), gomock.Any()).
		Return(emptyRows(ctrl), nil).
		Times(1)

	row := mock.NewMockRow(ctrl)
	row.EXPECT().Scan(gomock.Any()).Return(errors.New("pg_proc unreachable"))

	pool.EXPECT().
		QueryRow(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		Return(row).
		Times(1)

	client := postgres.NewClient(pool)

	_, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
		Name: "default",
		Functions: []metadata.FunctionMetadata{
			{
				Function: metadata.FunctionSource{Schema: "public", Name: "fn"},
			},
		},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "introspecting functions") {
		t.Errorf("error %q does not contain 'introspecting functions'", err.Error())
	}
}

// functionScan mirrors the row layout produced by the introspectFunction
// query (pg_proc), in scan order: arg_names, arg_types, num_defaults,
// return_type, is_setof, return_table_name, return_table_schema, volatility.
type functionScan struct {
	argNames     []string
	argTypes     []string
	numDefaults  int
	returnType   string
	isSetOf      bool
	returnTable  *string
	returnSchema *string
	volatility   string
}

func functionRow(t *testing.T, ctrl *gomock.Controller, fs functionScan) *mock.MockRow {
	t.Helper()

	row := mock.NewMockRow(ctrl)
	row.EXPECT().Scan(gomock.Any()).DoAndReturn(func(dest ...any) error {
		if len(dest) != 8 {
			t.Fatalf("expected 8 dest, got %d", len(dest))
		}

		assignDest(t, dest[0], fs.argNames)
		assignDest(t, dest[1], fs.argTypes)
		assignDest(t, dest[2], fs.numDefaults)
		assignDest(t, dest[3], fs.returnType)
		assignDest(t, dest[4], fs.isSetOf)
		assignDest(t, dest[5], fs.returnTable)
		assignDest(t, dest[6], fs.returnSchema)
		assignDest(t, dest[7], fs.volatility)

		return nil
	})

	return row
}

// TestIntrospect_FunctionVolatility drives introspectFunction's volatility
// switch by feeding the IMMUTABLE/STABLE/VOLATILE/<default> codes through
// the Introspect public path. Also exercises the nullable returnTableName /
// returnSchema -> "" reshape on the populated-pointer side.
func TestIntrospect_FunctionVolatility(t *testing.T) {
	t.Parallel()

	tableName := "users"
	tableSchema := "public"

	tests := []struct {
		name        string
		input       functionScan
		wantVol     introspection.Volatility
		wantTblName string
		wantTblSch  string
	}{
		{
			name: "IMMUTABLE maps to VolatilityImmutable",
			input: functionScan{
				argTypes:   []string{},
				returnType: "int4",
				volatility: "IMMUTABLE",
			},
			wantVol: introspection.VolatilityImmutable,
		},
		{
			name: "STABLE maps to VolatilityStable",
			input: functionScan{
				argTypes:   []string{},
				returnType: "int4",
				volatility: "STABLE",
			},
			wantVol: introspection.VolatilityStable,
		},
		{
			name: "VOLATILE maps to VolatilityVolatile",
			input: functionScan{
				argTypes:   []string{},
				returnType: "int4",
				volatility: "VOLATILE",
			},
			wantVol: introspection.VolatilityVolatile,
		},
		{
			name: "unknown volatility falls through to Volatile",
			input: functionScan{
				argTypes:   []string{},
				returnType: "int4",
				volatility: "WAT",
			},
			wantVol: introspection.VolatilityVolatile,
		},
		{
			name: "non-nil return table reshapes to non-empty TableName/Schema",
			input: functionScan{
				argTypes:     []string{},
				returnType:   "record",
				isSetOf:      true,
				returnTable:  &tableName,
				returnSchema: &tableSchema,
				volatility:   "STABLE",
			},
			wantVol:     introspection.VolatilityStable,
			wantTblName: tableName,
			wantTblSch:  tableSchema,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)

			// No schemas, so per-schema work is skipped.
			pool.EXPECT().
				Query(gomock.Any(), gomock.Any()).
				Return(emptyRows(ctrl), nil).
				Times(1)

			row := functionRow(t, ctrl, tt.input)

			pool.EXPECT().
				QueryRow(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
				Return(row).
				Times(1)

			client := postgres.NewClient(pool)

			objs, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
				Name: "default",
				Functions: []metadata.FunctionMetadata{
					{
						Function: metadata.FunctionSource{Schema: "public", Name: "fn"},
					},
				},
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			fn, ok := objs.Functions["public.fn"]
			if !ok {
				t.Fatal("expected public.fn in Functions map")
			}

			if fn.Volatility != tt.wantVol {
				t.Errorf("Volatility = %q, want %q", fn.Volatility, tt.wantVol)
			}

			if fn.ReturnType.TableName != tt.wantTblName {
				t.Errorf(
					"ReturnType.TableName = %q, want %q",
					fn.ReturnType.TableName, tt.wantTblName,
				)
			}

			if fn.ReturnType.TableSchema != tt.wantTblSch {
				t.Errorf(
					"ReturnType.TableSchema = %q, want %q",
					fn.ReturnType.TableSchema, tt.wantTblSch,
				)
			}
		})
	}
}

// TestIntrospect_EnumTable drives getEnumTable through the public Introspect
// path. The two cases exercise the descCol == "" branch (single-column SELECT)
// and descCol != "" branch (two-column SELECT with optional description).
func TestIntrospect_EnumTable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		columns      []columnScan
		wantValues   []introspection.EnumValue
		descColEmpty bool
	}{
		{
			name: "enum table with description column",
			columns: []columnScan{
				{
					tableName: "status", columnName: "value",
					typeName: "text", isNullable: "NO",
				},
				{
					tableName: "status", columnName: "description",
					typeName: "text", isNullable: "YES",
				},
			},
			wantValues: []introspection.EnumValue{
				{Value: "active", Comment: "is active"},
				{Value: "inactive", Comment: ""},
			},
			descColEmpty: false,
		},
		{
			name: "enum table without description column",
			columns: []columnScan{
				{
					tableName: "status", columnName: "value",
					typeName: "text", isNullable: "NO",
				},
			},
			wantValues: []introspection.EnumValue{
				{Value: "active", Comment: ""},
				{Value: "inactive", Comment: ""},
			},
			descColEmpty: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			pool := mock.NewMockPool(ctrl)

			wireEnumIntrospect(
				t, ctrl, pool, "public",
				tt.columns, tt.wantValues, tt.descColEmpty,
			)

			client := postgres.NewClient(pool)

			objs, err := client.Introspect(t.Context(), &metadata.DatabaseMetadata{
				Name: "default",
				Tables: []metadata.TableMetadata{
					{
						Table: metadata.TableSource{
							Schema: "public",
							Name:   "status",
						},
						IsEnum: true,
					},
				},
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			got, ok := objs.EnumValues["public.status"]
			if !ok {
				t.Fatal("expected public.status in EnumValues map")
			}

			if len(got) != len(tt.wantValues) {
				t.Fatalf("got %d enum values, want %d", len(got), len(tt.wantValues))
			}

			for i, want := range tt.wantValues {
				if got[i].Value != want.Value || got[i].Comment != want.Comment {
					t.Errorf("EnumValue[%d] = %+v, want %+v", i, got[i], want)
				}
			}
		})
	}
}

// wireEnumIntrospect configures `pool` for the full enum-table Introspect
// flow: schema discovery + populateTableColumns + primary-key discovery +
// the getEnumTable Query that returns the canned values. The first column
// in `columns` must be the PK column.
func wireEnumIntrospect(
	t *testing.T,
	ctrl *gomock.Controller,
	pool *mock.MockPool,
	schemaName string,
	columns []columnScan,
	values []introspection.EnumValue,
	descColEmpty bool,
) {
	t.Helper()

	pool.EXPECT().
		Query(gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, sql string, _ ...any) (postgres.Rows, error) {
			if strings.Contains(sql, "information_schema.schemata") {
				return singleStringRows(ctrl, schemaName), nil
			}
			// getEnumTable's SELECT is no-args; route by the absence of the
			// schemata table.
			return enumValueRows(t, ctrl, values, descColEmpty), nil
		}).
		AnyTimes()

	pool.EXPECT().
		Query(gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, sql string, _ ...any) (postgres.Rows, error) {
			switch {
			case strings.Contains(sql, "type_aggregates"):
				return columnRowsMock(t, ctrl, columns), nil
			case strings.Contains(sql, "pg_index"):
				return primaryKeyRows(t, ctrl, columns[0].columnName), nil
			default:
				return emptyRows(ctrl), nil
			}
		}).
		AnyTimes()

	pool.EXPECT().
		QueryRow(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).
		DoAndReturn(func(_ context.Context, _ string, _ ...any) postgres.Row {
			return nullRow(ctrl)
		}).
		AnyTimes()
}

// enumValueRows yields one row per EnumValue. When descColEmpty is true,
// only the value column is scanned; otherwise both value and a nullable
// description pointer are populated.
func enumValueRows(
	t *testing.T,
	ctrl *gomock.Controller,
	values []introspection.EnumValue,
	descColEmpty bool,
) *mock.MockRows {
	t.Helper()

	rows := mock.NewMockRows(ctrl)
	call := 0

	rows.EXPECT().Next().DoAndReturn(func() bool {
		call++
		return call <= len(values)
	}).Times(len(values) + 1)

	rows.EXPECT().Scan(gomock.Any()).DoAndReturn(func(dest ...any) error {
		v := values[call-1]

		switch {
		case descColEmpty && len(dest) == 1:
			assignDest(t, dest[0], v.Value)
		case !descColEmpty && len(dest) == 2:
			assignDest(t, dest[0], v.Value)

			desc := v.Comment
			if desc == "" {
				assignDest[*string](t, dest[1], nil)
			} else {
				assignDest(t, dest[1], &desc)
			}
		default:
			t.Fatalf(
				"unexpected scan dest count: got %d, descColEmpty=%v",
				len(dest), descColEmpty,
			)
		}

		return nil
	}).Times(len(values))

	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()

	return rows
}

// primaryKeyRows yields one row per primary-key column with the constraint
// name "test_pkey".
func primaryKeyRows(
	t *testing.T, ctrl *gomock.Controller, columnName string,
) *mock.MockRows {
	t.Helper()

	rows := mock.NewMockRows(ctrl)
	call := 0
	rows.EXPECT().Next().DoAndReturn(func() bool {
		call++
		return call == 1
	}).Times(2)
	rows.EXPECT().Scan(gomock.Any(), gomock.Any()).DoAndReturn(func(dest ...any) error {
		assignDest(t, dest[0], columnName)
		assignDest(t, dest[1], "test_pkey")

		return nil
	})
	rows.EXPECT().Err().Return(nil)
	rows.EXPECT().Close()

	return rows
}
