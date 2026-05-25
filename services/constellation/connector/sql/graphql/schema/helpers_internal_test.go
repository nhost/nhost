package schema

import (
	"errors"
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestNormalizePostgresTypeToGraphQL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		pgType   string
		expected string
	}{
		{"integer", "Int"},
		{"int", "Int"},
		{"int4", "Int"},
		{"int2", "smallint"},
		{"smallint", "smallint"},
		{"int8", "bigint"},
		{"boolean", "Boolean"},
		{"bool", "Boolean"},
		{"text", "String"},
		{"varchar", "String"},
		{"character varying", "String"},
		{"char", "String"},
		{"character", "String"},
		{"name", "String"},
		{"uuid", "uuid"},
		{"timestamptz", "timestamptz"},
		{"jsonb", "jsonb"},
		{"citext", "citext"},
		{"float8", "float8"},
		{"numeric", "numeric"},
	}

	for _, tt := range tests {
		t.Run(tt.pgType, func(t *testing.T) {
			t.Parallel()

			got := normalizePostgresTypeToGraphQL(tt.pgType)
			if got != tt.expected {
				t.Errorf(
					"normalizePostgresTypeToGraphQL(%q) = %q, want %q",
					tt.pgType,
					got,
					tt.expected,
				)
			}
		})
	}
}

func TestIsCustomScalar(t *testing.T) {
	t.Parallel()

	tests := []struct {
		typeName string
		expected bool
	}{
		{"Int", false},
		{"Float", false},
		{"String", false},
		{"Boolean", false},
		{"ID", false},
		{"uuid", true},
		{"timestamptz", true},
		{"jsonb", true},
		{"citext", true},
		{"bigint", true},
		{"smallint", true},
		{"numeric", true},
	}

	for _, tt := range tests {
		t.Run(tt.typeName, func(t *testing.T) {
			t.Parallel()

			got := isCustomScalar(tt.typeName)
			if got != tt.expected {
				t.Errorf("isCustomScalar(%q) = %v, want %v", tt.typeName, got, tt.expected)
			}
		})
	}
}

func TestGetDefaultTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		schema   string
		table    string
		expected string
	}{
		{"public", "users", "users"},
		{"public", "auth_accounts", "auth_accounts"},
		{"auth", "users", "auth_users"},
		{"custom_schema", "my_table", "custom_schema_my_table"},
	}

	for _, tt := range tests {
		t.Run(tt.schema+"."+tt.table, func(t *testing.T) {
			t.Parallel()

			got := getDefaultTypeName(tt.schema, tt.table)
			if got != tt.expected {
				t.Errorf(
					"getDefaultTypeName(%q, %q) = %q, want %q",
					tt.schema,
					tt.table,
					got,
					tt.expected,
				)
			}
		})
	}
}

func TestGetColumnDescription(t *testing.T) {
	t.Parallel()

	comment := "user email address"
	tests := []struct {
		name     string
		col      introspection.Column
		expected string
	}{
		{
			"with comment",
			introspection.Column{Name: "email", Comment: &comment},
			"user email address",
		},
		{
			"nil comment",
			introspection.Column{Name: "id", Comment: nil},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := getColumnDescription(&tt.col)
			if got != tt.expected {
				t.Errorf("getColumnDescription() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestAllPKColumnsAllowed(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		pks      []string
		allowed  map[string]struct{}
		expected bool
	}{
		{
			"all allowed",
			[]string{"id"},
			map[string]struct{}{"id": {}, "name": {}},
			true,
		},
		{
			"composite pk all allowed",
			[]string{"user_id", "org_id"},
			map[string]struct{}{"user_id": {}, "org_id": {}, "role": {}},
			true,
		},
		{
			"missing pk column",
			[]string{"id", "tenant_id"},
			map[string]struct{}{"id": {}},
			false,
		},
		{
			"empty pks",
			[]string{},
			map[string]struct{}{"id": {}},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := allPKColumnsAllowed(tt.pks, tt.allowed)
			if got != tt.expected {
				t.Errorf("allPKColumnsAllowed() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestGetComparisonOperators(t *testing.T) {
	t.Parallel()

	pgCaps := Capabilities{
		Kind:          KindPostgres,
		SupportsRegex: true,
		SupportsJSONB: true,
	}

	sqliteCaps := Capabilities{
		Kind: KindSQLite,
	}

	tests := []struct {
		name     string
		scalar   string
		caps     Capabilities
		contains []string
		excludes []string
	}{
		{
			name:     "String with regex",
			scalar:   "String",
			caps:     pgCaps,
			contains: []string{"_regex", "_ilike"},
			excludes: nil,
		},
		{
			name:     "String without regex",
			scalar:   "String",
			caps:     sqliteCaps,
			contains: []string{"_ilike"},
			excludes: []string{"_regex", "_similar"},
		},
		{
			name:     "Int always same",
			scalar:   "Int",
			caps:     pgCaps,
			contains: []string{"_eq", "_in"},
			excludes: []string{"_like"},
		},
		{
			name:     "jsonb with support",
			scalar:   "jsonb",
			caps:     pgCaps,
			contains: []string{"_cast", "_contains", "_has_key"},
			excludes: nil,
		},
		{
			name:     "jsonb without support",
			scalar:   "jsonb",
			caps:     sqliteCaps,
			contains: nil,
			excludes: []string{"_cast", "_contains", "_has_key"},
		},
		{
			name:     "unknown type gets defaults",
			scalar:   "custom_type",
			caps:     pgCaps,
			contains: []string{"_eq", "_in"},
			excludes: []string{"_like", "_regex"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ops := getComparisonOperators(tt.scalar, tt.caps)
			for _, op := range tt.contains {
				if !contains(ops, op) {
					t.Errorf("expected %q in operators for %s/%s", op, tt.scalar, tt.caps.Kind)
				}
			}

			for _, op := range tt.excludes {
				if contains(ops, op) {
					t.Errorf(
						"did not expect %q in operators for %s/%s",
						op,
						tt.scalar,
						tt.caps.Kind,
					)
				}
			}
		})
	}
}

// TestCapabilitiesNamespaceTypeName asserts the single dialect-namespacing
// convention shared by comparisonExpName, castExpName and arrayComparisonExpName.
// Per-method tests would only re-test the prefix; this exercises the convention
// itself.
func TestCapabilitiesNamespaceTypeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		kind     DBKind
		prefix   string
		suffix   string
		expected string
	}{
		{"postgres comparison", KindPostgres, "String", "comparison_exp", "String_comparison_exp"},
		{"empty kind treated as postgres", "", "Int", "comparison_exp", "Int_comparison_exp"},
		{
			"sqlite comparison",
			KindSQLite,
			"String",
			"comparison_exp",
			"String_sqlite_comparison_exp",
		},
		{"postgres cast", KindPostgres, "jsonb", "cast_exp", "jsonb_cast_exp"},
		{"sqlite cast", KindSQLite, "jsonb", "cast_exp", "jsonb_sqlite_cast_exp"},
		{
			"postgres array",
			KindPostgres,
			"String",
			"array_comparison_exp",
			"String_array_comparison_exp",
		},
		{
			"sqlite array",
			KindSQLite,
			"String",
			"array_comparison_exp",
			"String_sqlite_array_comparison_exp",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			caps := Capabilities{Kind: tt.kind}

			got := caps.namespaceTypeName(tt.prefix, tt.suffix)
			if got != tt.expected {
				t.Errorf(
					"namespaceTypeName(%q, %q) for kind %q = %q, want %q",
					tt.prefix, tt.suffix, tt.kind, got, tt.expected,
				)
			}
		})
	}
}

func TestGenerateArrayComparisonExp(t *testing.T) {
	t.Parallel()

	caps := Capabilities{Kind: KindPostgres, SupportsArrays: true}

	result := generateArrayComparisonExp("String", caps)

	if result.Name != "String_array_comparison_exp" {
		t.Errorf("expected name %q, got %q", "String_array_comparison_exp", result.Name)
	}

	expectedFields := map[string]bool{
		"_contained_in": false,
		"_contains":     false,
		"_eq":           false,
		"_gt":           false,
		"_gte":          false,
		"_in":           false,
		"_is_null":      false,
		"_lt":           false,
		"_lte":          false,
		"_neq":          false,
		"_nin":          false,
	}

	for _, f := range result.Fields {
		if _, ok := expectedFields[f.Name]; ok {
			expectedFields[f.Name] = true
		} else {
			t.Errorf("unexpected field %q", f.Name)
		}
	}

	for name, found := range expectedFields {
		if !found {
			t.Errorf("missing expected field %q", name)
		}
	}
}

func TestGenerateArrayComparisonExpSQLite(t *testing.T) {
	t.Parallel()

	caps := Capabilities{Kind: KindSQLite, SupportsArrays: true}

	result := generateArrayComparisonExp("Int", caps)

	if result.Name != "Int_sqlite_array_comparison_exp" {
		t.Errorf("expected name %q, got %q", "Int_sqlite_array_comparison_exp", result.Name)
	}
}

func TestCollectionArgumentsDistinctOn(t *testing.T) {
	t.Parallel()

	standardArgs := []string{"limit", "offset", "order_by", "where"}

	tests := []struct {
		name              string
		supportDistinctOn bool
		wantDistinctOn    bool
	}{
		{name: "with distinct_on support", supportDistinctOn: true, wantDistinctOn: true},
		{name: "without distinct_on support", supportDistinctOn: false, wantDistinctOn: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			caps := Capabilities{SupportsDistinctOn: tt.supportDistinctOn}
			args := collectionArguments("users", caps)

			if got := hasArgument(args, "distinct_on"); got != tt.wantDistinctOn {
				t.Errorf("hasArgument(distinct_on) = %v, want %v", got, tt.wantDistinctOn)
			}

			for _, name := range standardArgs {
				if !hasArgument(args, name) {
					t.Errorf("missing standard collection argument %q", name)
				}
			}
		})
	}
}

func TestIsObjectRelationshipNullable(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		using     metadata.RelationshipUsing
		tableInfo *introspection.Table
		want      bool
	}{
		{
			name: "reverse FK is always nullable",
			using: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Table:   metadata.TableSource{Schema: "public", Name: "posts"},
					Columns: nil,
				},
			},
			tableInfo: &introspection.Table{},
			want:      true,
		},
		{
			name: "forward FK nullable column",
			using: metadata.RelationshipUsing{
				ForeignKeyColumns: []string{"org_id"},
			},
			tableInfo: &introspection.Table{
				Columns: []introspection.Column{
					{Name: "org_id", IsNullable: true},
				},
			},
			want: true,
		},
		{
			name: "forward FK non-nullable column",
			using: metadata.RelationshipUsing{
				ForeignKeyColumns: []string{"org_id"},
			},
			tableInfo: &introspection.Table{
				Columns: []introspection.Column{
					{Name: "org_id", IsNullable: false},
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := isObjectRelationshipNullable(tt.tableInfo, tt.using)
			if got != tt.want {
				t.Errorf("isObjectRelationshipNullable() = %v, want %v", got, tt.want)
			}
		})
	}
}

func contains(slice []string, val string) bool {
	return slices.Contains(slice, val)
}

func hasArgument(args []*graph.Argument, name string) bool {
	for _, a := range args {
		if a.Name == name {
			return true
		}
	}

	return false
}

// TestParseDBKind covers the string→DBKind boundary: known values map to
// their canonical constants (with "" promoted to KindPostgres for legacy
// metadata), and unknown values return ErrUnknownDBKind without leaking the
// untyped string through to namespacing.
func TestParseDBKind(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    DBKind
		wantErr bool
	}{
		{name: "empty defaults to postgres", input: "", want: KindPostgres},
		{name: "postgres explicit", input: "postgres", want: KindPostgres},
		{name: "sqlite", input: "sqlite", want: KindSQLite},
		{name: "typo rejected", input: "postgress", wantErr: true},
		{name: "unknown rejected", input: "mysql", wantErr: true},
		{name: "case-sensitive rejected", input: "Postgres", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := ParseDBKind(tt.input)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("ParseDBKind(%q): expected error, got nil", tt.input)
				}

				if !errors.Is(err, ErrUnknownDBKind) {
					t.Errorf("ParseDBKind(%q): err = %v, want ErrUnknownDBKind", tt.input, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("ParseDBKind(%q): unexpected error: %v", tt.input, err)
			}

			if got != tt.want {
				t.Errorf("ParseDBKind(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
