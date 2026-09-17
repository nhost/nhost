package introspection_test

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
)

func TestGetTable(t *testing.T) {
	t.Parallel()

	usersTable := &introspection.Table{Schema: "public", Name: "users"}
	objects := introspection.NewObjects()
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": usersTable,
		},
	}

	tests := []struct {
		name      string
		objects   *introspection.Objects
		schema    string
		table     string
		wantTable *introspection.Table
		wantOK    bool
	}{
		{
			name:      "found",
			objects:   objects,
			schema:    "public",
			table:     "users",
			wantTable: usersTable,
			wantOK:    true,
		},
		{
			name:      "schema not found",
			objects:   objects,
			schema:    "private",
			table:     "users",
			wantTable: nil,
			wantOK:    false,
		},
		{
			name:      "table not found",
			objects:   objects,
			schema:    "public",
			table:     "posts",
			wantTable: nil,
			wantOK:    false,
		},
		{
			name:      "empty objects",
			objects:   introspection.NewObjects(),
			schema:    "public",
			table:     "users",
			wantTable: nil,
			wantOK:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := tt.objects.GetTable(tt.schema, tt.table)
			if ok != tt.wantOK {
				t.Errorf("GetTable() ok = %v, want %v", ok, tt.wantOK)
			}

			if got != tt.wantTable {
				t.Errorf("GetTable() got = %v, want %v", got, tt.wantTable)
			}
		})
	}
}

func TestGetEnumValues(t *testing.T) {
	t.Parallel()

	objects := introspection.NewObjects()
	objects.EnumValues["public.status"] = []introspection.EnumValue{
		{Value: "active", Comment: "Active status"},
		{Value: "inactive", Comment: "Inactive status"},
	}

	tests := []struct {
		name    string
		objects *introspection.Objects
		schema  string
		table   string
		wantOK  bool
		wantLen int
	}{
		{
			name:    "found",
			objects: objects,
			schema:  "public",
			table:   "status",
			wantOK:  true,
			wantLen: 2,
		},
		{
			name:    "not found",
			objects: objects,
			schema:  "public",
			table:   "missing",
			wantOK:  false,
			wantLen: 0,
		},
		{
			name:    "empty objects",
			objects: introspection.NewObjects(),
			schema:  "public",
			table:   "status",
			wantOK:  false,
			wantLen: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			values, ok := tt.objects.GetEnumValues(tt.schema, tt.table)
			if ok != tt.wantOK {
				t.Errorf("GetEnumValues() ok = %v, want %v", ok, tt.wantOK)
			}

			if len(values) != tt.wantLen {
				t.Errorf("GetEnumValues() len = %d, want %d", len(values), tt.wantLen)
			}
		})
	}
}

func TestGetFunction(t *testing.T) {
	t.Parallel()

	fn := &introspection.Function{
		Arguments:  nil,
		ReturnType: introspection.FunctionReturnType{},
		Volatility: introspection.VolatilityStable,
	}
	objects := introspection.NewObjects()
	objects.Functions["public.my_func"] = fn

	tests := []struct {
		name     string
		objects  *introspection.Objects
		schema   string
		funcName string
		wantFn   *introspection.Function
		wantOK   bool
	}{
		{
			name:     "found",
			objects:  objects,
			schema:   "public",
			funcName: "my_func",
			wantFn:   fn,
			wantOK:   true,
		},
		{
			name:     "not found",
			objects:  objects,
			schema:   "public",
			funcName: "missing",
			wantFn:   nil,
			wantOK:   false,
		},
		{
			name:     "empty objects",
			objects:  introspection.NewObjects(),
			schema:   "public",
			funcName: "my_func",
			wantFn:   nil,
			wantOK:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ok := tt.objects.GetFunction(tt.schema, tt.funcName)
			if ok != tt.wantOK {
				t.Errorf("GetFunction() ok = %v, want %v", ok, tt.wantOK)
			}

			if got != tt.wantFn {
				t.Errorf("GetFunction() got = %v, want %v", got, tt.wantFn)
			}
		})
	}
}

func TestEnumColumns(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		table       introspection.Table
		wantValue   string
		wantDesc    string
		wantErr     bool
		errContains string
	}{
		{
			name: "zero primary keys",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{},
				Columns: []introspection.Column{
					{Name: "value"},
				},
			},
			wantErr:     true,
			errContains: "must have exactly one primary key column, got 0",
		},
		{
			name: "two primary keys",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"id", "code"},
				Columns: []introspection.Column{
					{Name: "id"},
					{Name: "code"},
				},
			},
			wantErr:     true,
			errContains: "must have exactly one primary key column, got 2",
		},
		{
			name: "one PK one column only",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"value"},
				Columns: []introspection.Column{
					{Name: "value"},
				},
			},
			wantValue: "value",
			wantDesc:  "",
		},
		{
			name: "one PK two columns with description",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"value"},
				Columns: []introspection.Column{
					{Name: "value"},
					{Name: "description"},
				},
			},
			wantValue: "value",
			wantDesc:  "description",
		},
		{
			name: "one PK three columns error",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"value"},
				Columns: []introspection.Column{
					{Name: "value"},
					{Name: "description"},
					{Name: "extra"},
				},
			},
			wantErr:     true,
			errContains: "must have at most 2 columns",
		},
		{
			name: "pk column missing from columns",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"value"},
				Columns: []introspection.Column{
					{Name: "other"},
				},
			},
			wantErr:     true,
			errContains: `primary key column "value" is not in the column list`,
		},
		{
			name: "pk column missing with description-shaped second column",
			table: introspection.Table{
				Schema:      "public",
				Name:        "status",
				PrimaryKeys: []string{"value"},
				Columns: []introspection.Column{
					{Name: "other"},
					{Name: "description"},
				},
			},
			wantErr:     true,
			errContains: `primary key column "value" is not in the column list`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			valueCol, descCol, err := tt.table.EnumColumns()

			if tt.wantErr {
				if err == nil {
					t.Fatal("EnumColumns() expected error, got nil")
				}

				if tt.errContains != "" {
					if got := err.Error(); !strings.Contains(got, tt.errContains) {
						t.Errorf("error %q does not contain %q", got, tt.errContains)
					}
				}

				return
			}

			if err != nil {
				t.Fatalf("EnumColumns() unexpected error: %v", err)
			}

			if valueCol != tt.wantValue {
				t.Errorf("EnumColumns() valueCol = %q, want %q", valueCol, tt.wantValue)
			}

			if descCol != tt.wantDesc {
				t.Errorf("EnumColumns() descCol = %q, want %q", descCol, tt.wantDesc)
			}
		})
	}
}

func TestIsTableType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		rt   introspection.FunctionReturnType
		want bool
	}{
		{
			name: "both fields set",
			rt:   introspection.FunctionReturnType{TableSchema: "public", TableName: "users"},
			want: true,
		},
		{
			name: "schema empty",
			rt:   introspection.FunctionReturnType{TableSchema: "", TableName: "users"},
			want: false,
		},
		{
			name: "name empty",
			rt:   introspection.FunctionReturnType{TableSchema: "public", TableName: ""},
			want: false,
		},
		{
			name: "both empty",
			rt:   introspection.FunctionReturnType{TableSchema: "", TableName: ""},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.rt.IsTableType(); got != tt.want {
				t.Errorf("IsTableType() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTableLookupForwardFKTarget(t *testing.T) {
	t.Parallel()

	table := &introspection.Table{
		Schema: "public",
		Name:   "posts",
		ForeignKeys: []introspection.ForeignKey{
			{
				ColumnName:        "author_id",
				ForeignSchema:     "public",
				ForeignTable:      "users",
				ForeignColumnName: "id",
			},
			{
				ColumnName:        "tenant_id",
				ForeignSchema:     "public",
				ForeignTable:      "users",
				ForeignColumnName: "tenant_id",
			},
			{
				ColumnName:        "category_id",
				ForeignSchema:     "public",
				ForeignTable:      "categories",
				ForeignColumnName: "id",
			},
		},
	}

	tests := []struct {
		name       string
		table      *introspection.Table
		fkColumns  []string
		wantSchema string
		wantName   string
	}{
		{
			name:       "single column match",
			table:      table,
			fkColumns:  []string{"author_id"},
			wantSchema: "public",
			wantName:   "users",
		},
		{
			name:       "composite agreement on same target",
			table:      table,
			fkColumns:  []string{"author_id", "tenant_id"},
			wantSchema: "public",
			wantName:   "users",
		},
		{
			name:       "composite mismatch returns empty",
			table:      table,
			fkColumns:  []string{"author_id", "category_id"},
			wantSchema: "",
			wantName:   "",
		},
		{
			name:       "missing column returns empty",
			table:      table,
			fkColumns:  []string{"author_id", "nonexistent_id"},
			wantSchema: "",
			wantName:   "",
		},
		{
			name:       "single missing column returns empty",
			table:      table,
			fkColumns:  []string{"nonexistent_id"},
			wantSchema: "",
			wantName:   "",
		},
		{
			name:       "empty fkColumns returns empty",
			table:      table,
			fkColumns:  nil,
			wantSchema: "",
			wantName:   "",
		},
		{
			name: "table with no FKs returns empty",
			table: &introspection.Table{
				Schema: "public",
				Name:   "posts",
			},
			fkColumns:  []string{"author_id"},
			wantSchema: "",
			wantName:   "",
		},
		{
			name:       "single column shared with a composite constraint",
			table:      sharedColumnTable(),
			fkColumns:  []string{"org_id"},
			wantSchema: "public",
			wantName:   "orgs",
		},
		{
			name:       "composite constraint sharing a column",
			table:      sharedColumnTable(),
			fkColumns:  []string{"org_id", "user_id"},
			wantSchema: "public",
			wantName:   "org_users",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotSchema, gotName := tt.table.LookupForwardFKTarget(tt.fkColumns)
			if gotSchema != tt.wantSchema {
				t.Errorf(
					"LookupForwardFKTarget() schema = %q, want %q",
					gotSchema, tt.wantSchema,
				)
			}

			if gotName != tt.wantName {
				t.Errorf(
					"LookupForwardFKTarget() name = %q, want %q",
					gotName, tt.wantName,
				)
			}
		})
	}
}

// sharedColumnTable mirrors the PostgreSQL introspection order (by constraint
// name) for a table where org_id belongs to both a single-column and a
// composite foreign key: orders_membership_fkey sorts before
// orders_org_id_fkey.
func sharedColumnTable() *introspection.Table {
	return &introspection.Table{
		Schema: "public",
		Name:   "orders",
		ForeignKeys: []introspection.ForeignKey{
			{
				Constraint:        "orders_membership_fkey",
				ColumnName:        "user_id",
				ForeignSchema:     "public",
				ForeignTable:      "org_users",
				ForeignColumnName: "id",
			},
			{
				Constraint:        "orders_membership_fkey",
				ColumnName:        "org_id",
				ForeignSchema:     "public",
				ForeignTable:      "org_users",
				ForeignColumnName: "org_id",
			},
			{
				Constraint:        "orders_org_id_fkey",
				ColumnName:        "org_id",
				ForeignSchema:     "public",
				ForeignTable:      "orgs",
				ForeignColumnName: "id",
			},
			{
				Constraint:        "orders_user_id_fkey",
				ColumnName:        "user_id",
				ForeignSchema:     "public",
				ForeignTable:      "org_users",
				ForeignColumnName: "id",
			},
		},
	}
}

func TestTableLookupForwardFK(t *testing.T) {
	t.Parallel()

	table := sharedColumnTable()

	tests := []struct {
		name      string
		fkColumns []string
		want      []introspection.ForeignKey
	}{
		{
			name:      "single column prefers the single-column constraint",
			fkColumns: []string{"org_id"},
			want:      []introspection.ForeignKey{table.ForeignKeys[2]},
		},
		{
			name:      "composite columns select the composite constraint",
			fkColumns: []string{"org_id", "user_id"},
			want: []introspection.ForeignKey{
				table.ForeignKeys[1],
				table.ForeignKeys[0],
			},
		},
		{
			name:      "unmatched column returns nil",
			fkColumns: []string{"org_id", "missing"},
			want:      nil,
		},
		{
			name:      "empty returns nil",
			fkColumns: nil,
			want:      nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := table.LookupForwardFK(tt.fkColumns)
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("LookupForwardFK() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
