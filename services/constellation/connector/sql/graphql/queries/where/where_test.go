package where_test

import (
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	dialectmock "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// stubTableForFieldComparison provides the minimal Table surface
// ParseFieldComparison needs (just Dialect()). Other methods aren't called
// by the comparison parser, so they return zero values — keeping the test
// focused on operator dispatch rather than the whole Table contract.
type stubTableForFieldComparison struct {
	d dialect.Dialect
}

func (s *stubTableForFieldComparison) Dialect() dialect.Dialect { return s.d }
func (s *stubTableForFieldComparison) SchemaName() string       { return "" }
func (s *stubTableForFieldComparison) TableFromClause() string  { return "" }
func (s *stubTableForFieldComparison) ColumnFromGraphqlName(string) *core.Column {
	return nil
}

func (s *stubTableForFieldComparison) RelationshipFromGraphqlName(
	string,
) where.Relationship {
	return nil
}

func (s *stubTableForFieldComparison) TableBySchemaName(
	_, _ string,
) where.Table {
	return nil
}

func (s *stubTableForFieldComparison) HasRowLevelPermissions(
	string,
) bool {
	return false
}

func (s *stubTableForFieldComparison) WriteRowLevelPermissions(
	_ *strings.Builder,
	params []any,
	paramIndex int,
	_ string,
	_ map[string]any,
	_ string,
) ([]any, int, error) {
	return params, paramIndex, nil
}

func (s *stubTableForFieldComparison) ParseFieldComparison(
	column *core.Column, value *ast.Value, variables map[string]any,
) (where.Statement, error) {
	//nolint:wrapcheck // test stub forwards parser errors verbatim for assertion.
	return where.ParseFieldComparison(
		s,
		column,
		value,
		variables,
	)
}

func runParseFieldComparison(
	t *testing.T,
	tbl where.Table,
	column *core.Column,
	value *ast.Value,
	variables map[string]any,
) (string, []any, error) {
	t.Helper()

	stmt, err := where.ParseFieldComparison(tbl, column, value, variables)
	if err != nil {
		return "", nil, err //nolint:wrapcheck // test helper preserves error for assertions.
	}

	if stmt == nil {
		return "", nil, nil
	}

	var b strings.Builder

	params, _, err := stmt.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		return "", nil, err //nolint:wrapcheck // test helper
	}

	return b.String(), params, nil
}

func TestParseFieldComparison_Eq(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "uuid").Return("$1::uuid")

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_eq",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "abc-123"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `"id"`) {
		t.Errorf("SQL should reference column 'id', got: %s", sql)
	}

	if len(params) != 1 || params[0] != "abc-123" {
		t.Errorf("params = %v, want [abc-123]", params)
	}
}

func TestParseFieldComparison_IsNull(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	col := &core.Column{
		SQLName:     "deleted_at",
		GraphqlName: "deleted_at",
		SQLType:     "timestamptz",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_is_null",
				Value: &ast.Value{Kind: ast.BooleanValue, Raw: "true"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "IS NULL") {
		t.Errorf("SQL should contain IS NULL, got: %s", sql)
	}

	if len(params) != 0 {
		t.Errorf("params should be empty for IS NULL, got: %v", params)
	}
}

func TestParseFieldComparison_IsNotNull(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	col := &core.Column{
		SQLName:     "deleted_at",
		GraphqlName: "deleted_at",
		SQLType:     "timestamptz",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_is_null",
				Value: &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
			},
		},
	}

	sql, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "IS NOT NULL") {
		t.Errorf("SQL should contain IS NOT NULL, got: %s", sql)
	}
}

// TestParseFieldComparison_IsNull_Variable pins that `_is_null: $v` resolves the
// GraphQL variable: $v=true yields IS NULL, $v=false yields IS NOT NULL. Before
// the fix the parser read value.Raw (the variable *name*) == "true", which is
// always false, so any variable produced IS NOT NULL regardless of $v.
func TestParseFieldComparison_IsNull_Variable(t *testing.T) {
	t.Parallel()

	col := &core.Column{
		SQLName:     "deleted_at",
		GraphqlName: "deleted_at",
		SQLType:     "timestamptz",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_is_null", Value: &ast.Value{Kind: ast.Variable, Raw: "v"}},
		},
	}

	tests := []struct {
		name     string
		varValue any
		want     string
	}{
		{name: "variable true yields IS NULL", varValue: true, want: "IS NULL"},
		{name: "variable false yields IS NOT NULL", varValue: false, want: "IS NOT NULL"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)

			sql, params, err := runParseFieldComparison(
				t,
				&stubTableForFieldComparison{d: d},
				col,
				value,
				map[string]any{"v": tt.varValue},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if !strings.Contains(sql, tt.want) {
				t.Errorf("SQL should contain %q, got: %s", tt.want, sql)
			}

			if len(params) != 0 {
				t.Errorf("params should be empty for IS [NOT] NULL, got: %v", params)
			}
		})
	}
}

// TestParseFieldComparison_IsNull_NullRejected pins that an explicit null for
// _is_null is rejected, matching Hasura ("expected a boolean for type 'Boolean',
// but found null"). It must hold for a literal null and for a variable that
// resolves to null; both reach the parser because the schema types _is_null as a
// nullable Boolean, so GraphQL validation lets the null through.
func TestParseFieldComparison_IsNull_NullRejected(t *testing.T) {
	t.Parallel()

	col := &core.Column{
		SQLName:     "deleted_at",
		GraphqlName: "deleted_at",
		SQLType:     "timestamptz",
		IsArray:     false,
	}

	tests := []struct {
		name      string
		value     *ast.Value
		variables map[string]any
	}{
		{
			name:  "literal null",
			value: &ast.Value{Kind: ast.NullValue},
		},
		{
			name:      "variable resolving to null",
			value:     &ast.Value{Kind: ast.Variable, Raw: "v"},
			variables: map[string]any{"v": nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)

			value := &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "_is_null", Value: tt.value},
				},
			}

			_, _, err := runParseFieldComparison(
				t,
				&stubTableForFieldComparison{d: d},
				col,
				value,
				tt.variables,
			)
			if err == nil {
				t.Fatal("expected error for null _is_null, got nil")
			}
		})
	}
}

func TestParseFieldComparison_MultipleOperators(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(gomock.Any()).DoAndReturn(func(idx int) string {
		return "$" + string(rune('0'+idx))
	}).AnyTimes()
	d.EXPECT().
		TypeCast(gomock.Any(), gomock.Any()).
		DoAndReturn(func(ph, sqlType string) string {
			return ph + "::" + sqlType
		}).
		AnyTimes()

	col := &core.Column{
		SQLName:     "age",
		GraphqlName: "age",
		SQLType:     "integer",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_gte",
				Value: &ast.Value{Kind: ast.IntValue, Raw: "18"},
			},
			{
				Name:  "_lte",
				Value: &ast.Value{Kind: ast.IntValue, Raw: "65"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "AND") {
		t.Errorf("SQL should contain AND for multiple operators, got: %s", sql)
	}

	if len(params) != 2 {
		t.Errorf("params count = %d, want 2", len(params))
	}
}

func TestParseFieldComparison_UnknownOperator(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_unknown",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "test"},
			},
		},
	}

	_, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err == nil {
		t.Error("expected error for unknown operator, got nil")
	}

	if !strings.Contains(err.Error(), "_unknown") {
		t.Errorf("error should mention the unknown operator, got: %v", err)
	}
}

func TestParseFieldComparison_EmptyObject(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind:     ast.ObjectValue,
		Children: nil,
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if sql != "" {
		t.Errorf("SQL should be empty for empty comparison, got: %s", sql)
	}

	if params != nil {
		t.Errorf("params should be nil for empty comparison, got: %v", params)
	}
}

func TestParseFieldComparison_NonObjectValue(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.StringValue,
		Raw:  "not-an-object",
	}

	_, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err == nil {
		t.Error("expected error for non-object value, got nil")
	}
}

func TestParseFieldComparison_In(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	// Stand in for dialect.WriteArrayIn: write a recognisable predicate and
	// append each value into params so we exercise the inFilter path through
	// the parser dispatch table.
	d.EXPECT().WriteArrayIn(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		b *strings.Builder, source, sqlName, _ string,
		values []any, params []any, paramIndex int,
	) ([]any, int) {
		b.WriteString(source)
		b.WriteByte('.')
		b.WriteString(sqlName)
		b.WriteString(" = ANY($1)")

		params = append(params, values...)

		return params, paramIndex + 1
	})

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_in",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "a"}},
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "b"}},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "= ANY($1)") {
		t.Errorf("expected ANY predicate from WriteArrayIn, got: %s", sql)
	}

	if len(params) != 2 || params[0] != "a" || params[1] != "b" {
		t.Errorf("params = %v, want [a b]", params)
	}
}

func TestParseFieldComparison_NotIn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().WriteArrayNotIn(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		b *strings.Builder, source, sqlName, _ string,
		values []any, params []any, paramIndex int,
	) ([]any, int) {
		b.WriteString(source)
		b.WriteByte('.')
		b.WriteString(sqlName)
		b.WriteString(" != ALL($1)")

		params = append(params, values...)

		return params, paramIndex + 1
	})

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_nin",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "x"}},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "!= ALL($1)") {
		t.Errorf("expected != ALL predicate from WriteArrayNotIn, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "x" {
		t.Errorf("params = %v, want [x]", params)
	}
}

func TestParseFieldComparison_In_WithVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().WriteArrayIn(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any(),
	).DoAndReturn(func(
		b *strings.Builder, _, sqlName, _ string,
		values []any, params []any, paramIndex int,
	) ([]any, int) {
		b.WriteString("in:")
		b.WriteString(sqlName)
		b.WriteByte(':')

		val, _ := values[0].(string)
		b.WriteString(val)

		return append(params, values...), paramIndex + 1
	})

	col := &core.Column{
		SQLName:     "name",
		GraphqlName: "name",
		SQLType:     "text",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_in",
				Value: &ast.Value{Kind: ast.Variable, Raw: "names"},
			},
		},
	}

	sql, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		map[string]any{"names": []any{"alice"}},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, "in:name:alice") {
		t.Errorf("expected variable-resolved array passed through, got: %s", sql)
	}
}

func TestParseFieldComparison_ContainsArrayColumn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")
	// arrayContainsFilter delegates to dialect.WriteArrayContains, which
	// receives the qualified column and the cast placeholder.
	d.EXPECT().WriteArrayContains(gomock.Any(), gomock.Any(), gomock.Any()).Do(
		func(b *strings.Builder, col, placeholder string) {
			b.WriteString(col)
			b.WriteString(" @> ")
			b.WriteString(placeholder)
		},
	)

	col := &core.Column{
		SQLName:     "tags",
		GraphqlName: "tags",
		SQLType:     "text[]",
		IsArray:     true,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_contains",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "go"}},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " @> $1::text[]") {
		t.Errorf("expected array @> predicate, got: %s", sql)
	}

	if len(params) != 1 {
		t.Fatalf("expected single param (array), got: %v", params)
	}
}

func TestParseFieldComparison_ContainsJSONBColumn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "jsonb").Return("$1::jsonb")

	col := &core.Column{
		SQLName:     "meta",
		GraphqlName: "meta",
		SQLType:     "jsonb",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_contains",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "a", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " @> $1::jsonb") {
		t.Errorf("expected JSONB @> predicate (cast to jsonb), got: %s", sql)
	}

	if len(params) != 1 {
		t.Fatalf("expected single param (json object), got: %v", params)
	}
}

func TestParseFieldComparison_ContainedInArrayColumn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")
	d.EXPECT().WriteArrayContainedIn(gomock.Any(), gomock.Any(), gomock.Any()).Do(
		func(b *strings.Builder, col, placeholder string) {
			b.WriteString(col)
			b.WriteString(" <@ ")
			b.WriteString(placeholder)
		},
	)

	col := &core.Column{
		SQLName:     "tags",
		GraphqlName: "tags",
		SQLType:     "text[]",
		IsArray:     true,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_contained_in",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "go"}},
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "rust"}},
					},
				},
			},
		},
	}

	sql, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " <@ $1::text[]") {
		t.Errorf("expected <@ predicate for array column, got: %s", sql)
	}
}

func TestParseFieldComparison_ContainedInJSONBColumn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "jsonb").Return("$1::jsonb")

	col := &core.Column{
		SQLName:     "meta",
		GraphqlName: "meta",
		SQLType:     "jsonb",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_contained_in",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "a", Value: &ast.Value{Kind: ast.IntValue, Raw: "1"}},
					},
				},
			},
		},
	}

	sql, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " <@ $1::jsonb") {
		t.Errorf("expected JSONB <@ predicate, got: %s", sql)
	}
}

func TestParseFieldComparison_HasKey(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")

	col := &core.Column{
		SQLName:     "data",
		GraphqlName: "data",
		SQLType:     "jsonb",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_has_key",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "foo"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " ? $1") {
		t.Errorf("expected ? key-exists predicate, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "foo" {
		t.Errorf("params = %v, want [foo]", params)
	}
}

func TestParseFieldComparison_HasKeysAll(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")

	col := &core.Column{
		SQLName:     "data",
		GraphqlName: "data",
		SQLType:     "jsonb",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_has_keys_all",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "a"}},
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "b"}},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " ?& $1::text[]") {
		t.Errorf("expected ?& predicate, got: %s", sql)
	}

	if len(params) != 1 {
		t.Fatalf("expected one param holding []string, got: %v", params)
	}

	keys, ok := params[0].([]string)
	if !ok || len(keys) != 2 || keys[0] != "a" || keys[1] != "b" {
		t.Errorf("expected []string{a, b}, got %T %v", params[0], params[0])
	}
}

func TestParseFieldComparison_HasKeysAny(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text[]").Return("$1::text[]")

	col := &core.Column{
		SQLName:     "data",
		GraphqlName: "data",
		SQLType:     "jsonb",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_has_keys_any",
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{Kind: ast.StringValue, Raw: "x"}},
					},
				},
			},
		},
	}

	sql, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, " ?| $1::text[]") {
		t.Errorf("expected ?| predicate, got: %s", sql)
	}
}

func TestNewRawFilter_WritesLiteralCondition(t *testing.T) {
	t.Parallel()

	stmt := where.NewRawFilter(`"t"."x" = 1`)
	if stmt == nil {
		t.Fatal("NewRawFilter returned nil Statement")
	}

	var b strings.Builder

	params, paramIndex, err := stmt.WriteCondition(&b, `"t"`, nil, 5)
	if err != nil {
		t.Fatalf("WriteCondition: %v", err)
	}

	if got := b.String(); got != `"t"."x" = 1` {
		t.Errorf("rendered SQL = %q, want literal condition", got)
	}

	if params != nil {
		t.Errorf("rawFilter must not append params, got %v", params)
	}

	if paramIndex != 5 {
		t.Errorf(
			"rawFilter must not consume a placeholder, paramIndex = %d, want 5",
			paramIndex,
		)
	}
}

func TestNewEqualsFilter_WritesEqualsPredicate(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "uuid").Return("$1::uuid")

	col := &core.Column{
		SQLName:     "id",
		GraphqlName: "id",
		SQLType:     "uuid",
		IsArray:     false,
	}

	stmt := where.NewEqualsFilter(col, "abc-123", d)
	if stmt == nil {
		t.Fatal("NewEqualsFilter returned nil Statement")
	}

	var b strings.Builder

	params, paramIndex, err := stmt.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("WriteCondition: %v", err)
	}

	if got, want := b.String(), `"t"."id" = $1::uuid`; got != want {
		t.Errorf("rendered SQL = %q, want %q", got, want)
	}

	if len(params) != 1 || params[0] != "abc-123" {
		t.Errorf("params = %v, want [abc-123]", params)
	}

	if paramIndex != 2 {
		t.Errorf("paramIndex = %d, want 2", paramIndex)
	}
}

func TestNewAndFilter_JoinsConditionsWithAnd(t *testing.T) {
	t.Parallel()

	stmt := where.NewAndFilter([]where.Statement{
		where.NewRawFilter(`"t"."a" = 1`),
		where.NewRawFilter(`"t"."b" = 2`),
	})
	if stmt == nil {
		t.Fatal("NewAndFilter returned nil Statement")
	}

	var b strings.Builder

	_, _, err := stmt.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("WriteCondition: %v", err)
	}

	got := b.String()

	if got != `"t"."a" = 1 AND "t"."b" = 2` {
		t.Errorf("rendered SQL = %q, want AND-joined predicates", got)
	}
}

func TestNewAndFilter_SingleCondition(t *testing.T) {
	t.Parallel()

	stmt := where.NewAndFilter([]where.Statement{
		where.NewRawFilter(`"t"."only" = 1`),
	})

	var b strings.Builder

	_, _, err := stmt.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("WriteCondition: %v", err)
	}

	if got := b.String(); got != `"t"."only" = 1` {
		t.Errorf("single-condition AND should emit just the predicate, got %q", got)
	}
}

func TestParseFieldComparison_WithVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{
		SQLName:     "name",
		GraphqlName: "name",
		SQLType:     "text",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_eq",
				Value: &ast.Value{Kind: ast.Variable, Raw: "userName"},
			},
		},
	}

	variables := map[string]any{
		"userName": "Alice",
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		variables,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `"name"`) {
		t.Errorf("SQL should reference column 'name', got: %s", sql)
	}

	if len(params) != 1 || params[0] != "Alice" {
		t.Errorf("params = %v, want [Alice]", params)
	}
}

// parseTestTable is a controllable Table used by the top-level Parse tests.
// Each map drives one of the lookup methods; nil values explicitly model
// "no match". The unexported `where.Table` interface is fully satisfied so
// it can be passed in to where.Parse from this external test package.
type parseTestTable struct {
	d            dialect.Dialect
	schemaName   string
	fromClause   string
	columns      map[string]*core.Column
	relationship map[string]where.Relationship
	siblings     map[string]where.Table
	roleHasPerms map[string]bool
	permsWriter  func(b *strings.Builder, params []any, paramIndex int, sourceRef string) ([]any, int, error)
}

func (p *parseTestTable) Dialect() dialect.Dialect { return p.d }
func (p *parseTestTable) SchemaName() string       { return p.schemaName }
func (p *parseTestTable) TableFromClause() string  { return p.fromClause }

func (p *parseTestTable) ColumnFromGraphqlName(name string) *core.Column {
	return p.columns[name]
}

func (p *parseTestTable) RelationshipFromGraphqlName(name string) where.Relationship {
	r, ok := p.relationship[name]
	if !ok {
		return nil
	}

	return r
}

func (p *parseTestTable) TableBySchemaName(schema, name string) where.Table {
	t, ok := p.siblings[schema+"."+name]
	if !ok {
		return nil
	}

	return t
}

func (p *parseTestTable) HasRowLevelPermissions(role string) bool {
	return p.roleHasPerms[role]
}

func (p *parseTestTable) WriteRowLevelPermissions(
	b *strings.Builder, params []any, paramIndex int,
	_ string, _ map[string]any, sourceRef string,
) ([]any, int, error) {
	if p.permsWriter != nil {
		return p.permsWriter(b, params, paramIndex, sourceRef)
	}

	return params, paramIndex, nil
}

func (p *parseTestTable) ParseFieldComparison(
	column *core.Column, value *ast.Value, variables map[string]any,
) (where.Statement, error) {
	//nolint:wrapcheck // test stub: forward parser error verbatim.
	return where.ParseFieldComparison(p, column, value, variables)
}

// parseTestRelationship is a controllable Relationship double for Parse tests.
type parseTestRelationship struct {
	target        where.Table
	parentCols    []string
	name          string
	aggregateName string
	isArray       bool
	joinWriter    func(b *strings.Builder, parent, target string)
}

func (r *parseTestRelationship) Target() where.Table { return r.target }
func (r *parseTestRelationship) ParentColumns() []string {
	return r.parentCols
}
func (r *parseTestRelationship) Name() string          { return r.name }
func (r *parseTestRelationship) AggregateName() string { return r.aggregateName }
func (r *parseTestRelationship) IsArray() bool         { return r.isArray }

func (r *parseTestRelationship) WriteJoinConditionAliased(
	b *strings.Builder, parent, target string,
) {
	if r.joinWriter != nil {
		r.joinWriter(b, parent, target)
	}
}

// renderClause writes a Clause against the canonical `"t"` source alias and
// returns the rendered SQL and captured params for assertions.
func renderClause(t *testing.T, clause where.Clause) (string, []any) {
	t.Helper()

	var b strings.Builder

	params, _, err := clause.WriteCondition(&b, `"t"`, nil, 1)
	if err != nil {
		t.Fatalf("Clause.WriteCondition: %v", err)
	}

	return b.String(), params
}

func TestParse_NilArg(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	clause, err := where.Parse(tbl, nil, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if clause != nil {
		t.Errorf("Parse(nil) = %v, want nil clause", clause)
	}
}

func TestParse_NonObjectArg(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{Kind: ast.StringValue, Raw: "nope"}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil {
		t.Fatal("expected error for non-object where arg, got nil")
	}
}

func TestParse_UnknownField(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "nonexistent", Value: &ast.Value{Kind: ast.ObjectValue}},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil || !strings.Contains(err.Error(), "nonexistent") {
		t.Errorf("expected unknown-field error mentioning the field, got: %v", err)
	}
}

func TestParse_EqOnKnownColumn(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"}

	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"name": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "name",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "_eq", Value: &ast.Value{Kind: ast.StringValue, Raw: "x"}},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := renderClause(t, clause)

	if !strings.Contains(sql, `"t"."name" = $1::text`) {
		t.Errorf("expected equals predicate, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "x" {
		t.Errorf("params = %v, want [x]", params)
	}
}

// buildEqOperator constructs `{column: {_eq: raw}}` — the canonical input for a
// single field comparison used by the logical-combinator tests below.
func buildEqOperator(column, raw string) *ast.ChildValue {
	return &ast.ChildValue{
		Name: column,
		Value: &ast.Value{
			Kind: ast.ObjectValue,
			Children: []*ast.ChildValue{
				{Name: "_eq", Value: &ast.Value{Kind: ast.StringValue, Raw: raw}},
			},
		},
	}
}

// buildLogicalListValue constructs `{<op>: [{a:{_eq:"1"}}, {b:{_eq:"2"}}]}` —
// the shared list-form input shape consumed by both _and and _or list tests.
func buildLogicalListValue(op string) *ast.Value {
	return &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: op,
				Value: &ast.Value{
					Kind: ast.ListValue,
					Children: []*ast.ChildValue{
						{Value: &ast.Value{
							Kind:     ast.ObjectValue,
							Children: []*ast.ChildValue{buildEqOperator("a", "1")},
						}},
						{Value: &ast.Value{
							Kind:     ast.ObjectValue,
							Children: []*ast.ChildValue{buildEqOperator("b", "2")},
						}},
					},
				},
			},
		},
	}
}

func TestParse_LogicalCombinators_ListForm(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		op             string
		wantSeparator  string
		wantParensWrap bool
	}{
		{name: "and list", op: "_and", wantSeparator: " AND ", wantParensWrap: false},
		{name: "or list", op: "_or", wantSeparator: " OR ", wantParensWrap: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			d := dialectmock.NewMockDialect(ctrl)
			d.EXPECT().Placeholder(gomock.Any()).DoAndReturn(func(i int) string {
				return "$" + string(rune('0'+i))
			}).Times(2)
			d.EXPECT().TypeCast(gomock.Any(), "text").DoAndReturn(
				func(p, _ string) string { return p + "::text" },
			).Times(2)

			colA := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
			colB := &core.Column{SQLName: "b", GraphqlName: "b", SQLType: "text"}

			tbl := &parseTestTable{
				d:       d,
				columns: map[string]*core.Column{"a": colA, "b": colB},
			}

			clause, err := where.Parse(
				tbl, buildLogicalListValue(tc.op), nil, "", nil, 0, where.QueryAliases,
			)
			if err != nil {
				t.Fatalf("Parse: %v", err)
			}

			sql, params := renderClause(t, clause)
			if !strings.Contains(sql, tc.wantSeparator) {
				t.Errorf("expected %q between siblings, got: %s", tc.wantSeparator, sql)
			}

			if tc.wantParensWrap &&
				(!strings.HasPrefix(sql, "(") || !strings.HasSuffix(sql, ")")) {
				t.Errorf("expected parens wrap, got: %s", sql)
			}

			if len(params) != 2 {
				t.Errorf("params = %v, want 2 entries", params)
			}
		})
	}
}

func TestParse_LogicalAnd_ObjectForm(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"a": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_and",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "a", Value: &ast.Value{
							Kind: ast.ObjectValue,
							Children: []*ast.ChildValue{
								{
									Name:  "_eq",
									Value: &ast.Value{Kind: ast.StringValue, Raw: "x"},
								},
							},
						}},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, _ := renderClause(t, clause)
	if !strings.Contains(sql, `"t"."a" = $1::text`) {
		t.Errorf("expected equals predicate (object _and), got: %s", sql)
	}
}

func TestParse_LogicalAnd_InvalidValueKind(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_and", Value: &ast.Value{Kind: ast.StringValue, Raw: "bad"}},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil {
		t.Fatal("expected error for non-list/object _and, got nil")
	}
}

func TestParse_LogicalOr_ObjectForm(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"a": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_or",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "a", Value: &ast.Value{
							Kind: ast.ObjectValue,
							Children: []*ast.ChildValue{
								{
									Name:  "_eq",
									Value: &ast.Value{Kind: ast.StringValue, Raw: "x"},
								},
							},
						}},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, _ := renderClause(t, clause)
	if !strings.HasPrefix(sql, "(") || !strings.HasSuffix(sql, ")") {
		t.Errorf("_or object should still wrap in parens, got: %s", sql)
	}

	if !strings.Contains(sql, `"t"."a" = $1::text`) {
		t.Errorf("expected nested predicate, got: %s", sql)
	}
}

func TestParse_LogicalOr_InvalidValueKind(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_or", Value: &ast.Value{Kind: ast.StringValue, Raw: "bad"}},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil {
		t.Fatal("expected error for non-list/object _or, got nil")
	}
}

// TestParse_LogicalAnd_WholeListVariable pins that `_and: $conds`, where the
// whole list is supplied as a single variable (typed [<table>_bool_exp!]),
// resolves and AND-joins. Before the fix value.Kind was ast.Variable, matching
// neither the ObjectValue nor ListValue branch, so it errored even though the
// same query succeeds on Hasura.
func TestParse_LogicalAnd_WholeListVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"a": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_and", Value: &ast.Value{Kind: ast.Variable, Raw: "conds"}},
		},
	}

	variables := map[string]any{
		"conds": []any{
			map[string]any{"a": map[string]any{"_eq": "x"}},
		},
	}

	clause, err := where.Parse(tbl, value, variables, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := renderClause(t, clause)
	if !strings.Contains(sql, `"t"."a" = $1::text`) {
		t.Errorf("expected equals predicate from list-variable _and, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "x" {
		t.Errorf("params = %v, want [x]", params)
	}
}

// TestParse_LogicalOr_WholeListVariable is the _or counterpart: a whole-list
// variable resolves and the disjunction is parenthesised, matching Hasura.
func TestParse_LogicalOr_WholeListVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"a": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_or", Value: &ast.Value{Kind: ast.Variable, Raw: "conds"}},
		},
	}

	variables := map[string]any{
		"conds": []any{
			map[string]any{"a": map[string]any{"_eq": "x"}},
		},
	}

	clause, err := where.Parse(tbl, value, variables, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := renderClause(t, clause)
	if !strings.HasPrefix(sql, "(") || !strings.HasSuffix(sql, ")") {
		t.Errorf("_or list variable should wrap in parens, got: %s", sql)
	}

	if !strings.Contains(sql, `"t"."a" = $1::text`) {
		t.Errorf("expected nested predicate, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "x" {
		t.Errorf("params = %v, want [x]", params)
	}
}

func TestParse_LogicalNot(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "a", GraphqlName: "a", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"a": col},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_not",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "a", Value: &ast.Value{
							Kind: ast.ObjectValue,
							Children: []*ast.ChildValue{
								{
									Name:  "_eq",
									Value: &ast.Value{Kind: ast.StringValue, Raw: "x"},
								},
							},
						}},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, _ := renderClause(t, clause)
	if !strings.HasPrefix(sql, "NOT (") || !strings.HasSuffix(sql, ")") {
		t.Errorf("_not should wrap NOT (...), got: %s", sql)
	}
}

func TestParse_Exists_WithExplicitSchema(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	siblingCol := &core.Column{SQLName: "x", GraphqlName: "x", SQLType: "text"}
	sibling := &parseTestTable{
		d:          d,
		schemaName: "other",
		fromClause: `"other"."friends"`,
		columns:    map[string]*core.Column{"x": siblingCol},
	}

	tbl := &parseTestTable{
		d:          d,
		schemaName: "public",
		fromClause: `"public"."t"`,
		siblings:   map[string]where.Table{"other.friends": sibling},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_exists",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{
							Name: "_table",
							Value: &ast.Value{
								Kind: ast.ObjectValue,
								Children: []*ast.ChildValue{
									{Name: "schema", Value: &ast.Value{
										Kind: ast.StringValue, Raw: "other",
									}},
									{Name: "name", Value: &ast.Value{
										Kind: ast.StringValue, Raw: "friends",
									}},
								},
							},
						},
						{
							Name: "_where",
							Value: &ast.Value{
								Kind: ast.ObjectValue,
								Children: []*ast.ChildValue{
									{Name: "x", Value: &ast.Value{
										Kind: ast.ObjectValue,
										Children: []*ast.ChildValue{
											{Name: "_eq", Value: &ast.Value{
												Kind: ast.StringValue, Raw: "y",
											}},
										},
									}},
								},
							},
						},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse _exists: %v", err)
	}

	sql, _ := renderClause(t, clause)
	if !strings.Contains(sql, `EXISTS (SELECT 1 FROM "other"."friends" e`) {
		t.Errorf("expected EXISTS subquery against sibling, got: %s", sql)
	}
}

func TestParse_Exists_DefaultsSchemaFromTable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)

	sibling := &parseTestTable{
		d:          d,
		schemaName: "public",
		fromClause: `"public"."friends"`,
	}

	tbl := &parseTestTable{
		d:          d,
		schemaName: "public",
		fromClause: `"public"."t"`,
		siblings:   map[string]where.Table{"public.friends": sibling},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_exists",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{
							Name: "_table",
							Value: &ast.Value{
								Kind: ast.ObjectValue,
								Children: []*ast.ChildValue{
									{Name: "name", Value: &ast.Value{
										Kind: ast.StringValue, Raw: "friends",
									}},
								},
							},
						},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse _exists: %v", err)
	}

	sql, _ := renderClause(t, clause)
	if !strings.Contains(sql, `"public"."friends" e`) {
		t.Errorf("expected default-schema resolution to use parent schema, got: %s", sql)
	}
}

// buildExistsValue builds an _exists where-arg whose `_table` object contains
// the listed key/value pairs verbatim. Pass an empty value to omit a key
// entirely (e.g. omit `name` to exercise the missing-name path).
func buildExistsValue(tableFields ...[2]string) *ast.Value {
	children := make([]*ast.ChildValue, 0, len(tableFields))
	for _, f := range tableFields {
		children = append(children, &ast.ChildValue{
			Name:  f[0],
			Value: &ast.Value{Kind: ast.StringValue, Raw: f[1]},
		})
	}

	return &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_exists",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{
							Name: "_table",
							Value: &ast.Value{
								Kind:     ast.ObjectValue,
								Children: children,
							},
						},
					},
				},
			},
		},
	}
}

func TestParse_Exists_ErrorPaths(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		value     *ast.Value
		wantInErr string
	}{
		{
			name:      "missing sibling",
			value:     buildExistsValue([2]string{"name", "missing"}),
			wantInErr: "missing",
		},
		{
			name:      "missing table name",
			value:     buildExistsValue([2]string{"schema", "public"}),
			wantInErr: "_exists._table.name",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tbl := &parseTestTable{schemaName: "public"}

			_, err := where.Parse(tbl, tc.value, nil, "", nil, 0, where.QueryAliases)
			if err == nil || !strings.Contains(err.Error(), tc.wantInErr) {
				t.Errorf("expected error containing %q, got: %v", tc.wantInErr, err)
			}
		})
	}
}

func TestParse_Exists_TableNotObject(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{schemaName: "public"}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_exists",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "_table", Value: &ast.Value{
							Kind: ast.StringValue, Raw: "bad",
						}},
					},
				},
			},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil || !strings.Contains(err.Error(), "_exists._table") {
		t.Errorf("expected _exists._table object error, got: %v", err)
	}
}

func TestParse_RelationshipTraversal(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	targetCol := &core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"}
	target := &parseTestTable{
		d:          d,
		fromClause: `"public"."authors"`,
		columns:    map[string]*core.Column{"name": targetCol},
	}

	rel := &parseTestRelationship{
		target: target,
		joinWriter: func(b *strings.Builder, parent, target string) {
			b.WriteString(parent)
			b.WriteString(".author_id = ")
			b.WriteString(target)
			b.WriteString(".id")
		},
	}

	tbl := &parseTestTable{
		d:            d,
		relationship: map[string]where.Relationship{"author": rel},
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "author",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{Name: "name", Value: &ast.Value{
							Kind: ast.ObjectValue,
							Children: []*ast.ChildValue{
								{Name: "_eq", Value: &ast.Value{
									Kind: ast.StringValue, Raw: "alice",
								}},
							},
						}},
					},
				},
			},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	sql, params := renderClause(t, clause)
	if !strings.Contains(sql, `EXISTS (SELECT 1 FROM "public"."authors" f`) {
		t.Errorf(
			"expected EXISTS for relationship using QueryAliases.Relationship, got: %s",
			sql,
		)
	}

	if !strings.Contains(sql, `"t".author_id = f.id`) {
		t.Errorf("expected join condition, got: %s", sql)
	}

	if !strings.Contains(sql, `f."name" = $1::text`) {
		t.Errorf("expected nested predicate against relationship target, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "alice" {
		t.Errorf("params = %v, want [alice]", params)
	}
}

func TestParse_TopLevelVariable(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "text").Return("$1::text")

	col := &core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"}
	tbl := &parseTestTable{
		d:       d,
		columns: map[string]*core.Column{"name": col},
	}

	// A top-level Variable value gets resolved into the captured Go map by
	// Parse via values.ResolveVariable, then traversed like a literal object.
	value := &ast.Value{Kind: ast.Variable, Raw: "filter"}

	variables := map[string]any{
		"filter": map[string]any{
			"name": map[string]any{"_eq": "Alice"},
		},
	}

	clause, err := where.Parse(tbl, value, variables, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("Parse with top-level variable: %v", err)
	}

	sql, params := renderClause(t, clause)
	if !strings.Contains(sql, `"t"."name" = $1::text`) {
		t.Errorf("expected equals predicate from resolved variable, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "Alice" {
		t.Errorf("params = %v, want [Alice]", params)
	}
}

func TestParse_VariableNotObject(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{Kind: ast.Variable, Raw: "filter"}

	_, err := where.Parse(
		tbl,
		value,
		map[string]any{"filter": "not-an-object"},
		"",
		nil,
		0,
		where.QueryAliases,
	)
	if err == nil {
		t.Fatal("expected error when resolved variable is not an object, got nil")
	}
}

// TestParse_NullArg covers a literal `where: null`. An explicit null filter is
// equivalent to omitting the argument: it must yield a nil clause, not an
// "expected object value" error.
func TestParse_NullArg(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{Kind: ast.NullValue}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if clause != nil {
		t.Errorf("Parse(null) = %v, want nil clause", clause)
	}
}

// TestParse_NullVariable covers `where: $where` with $where = null, an
// explicitly-null bool_exp variable present in the variables map. It must be
// treated as no filter rather than rejected.
func TestParse_NullVariable(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{Kind: ast.Variable, Raw: "where"}

	clause, err := where.Parse(
		tbl, value, map[string]any{"where": nil}, "", nil, 0, where.QueryAliases,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if clause != nil {
		t.Errorf("Parse(null variable) = %v, want nil clause", clause)
	}
}

// newRelationshipTable builds a table exposing a single "author" relationship
// whose join renders `<parent>.author_id = <target>.id`, shared by the nested
// relationship tests below.
func newRelationshipTable() *parseTestTable {
	target := &parseTestTable{
		fromClause: `"public"."authors"`,
	}

	rel := &parseTestRelationship{
		target: target,
		joinWriter: func(b *strings.Builder, parent, target string) {
			b.WriteString(parent)
			b.WriteString(".author_id = ")
			b.WriteString(target)
			b.WriteString(".id")
		},
	}

	return &parseTestTable{
		relationship: map[string]where.Relationship{"author": rel},
	}
}

// TestParse_NullNestedRelationship covers `where: {<relationship>: null}`. Only
// the top-level where argument is nullable; a null nested under a relationship
// is rejected, matching Hasura ("expected an object ... but found null").
func TestParse_NullNestedRelationship(t *testing.T) {
	t.Parallel()

	tbl := newRelationshipTable()

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "author", Value: &ast.Value{Kind: ast.NullValue}},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil {
		t.Fatal("expected error for null nested relationship, got nil")
	}

	if !strings.Contains(err.Error(), "expected object value") {
		t.Errorf("error = %v, want 'expected object value'", err)
	}
}

// TestParse_EmptyNestedRelationship covers `where: {<relationship>: {}}`. An
// empty nested bool_exp is the always-true filter, so the relationship renders
// its EXISTS join with no inner predicate and no params -- Hasura's "any
// related row exists".
func TestParse_EmptyNestedRelationship(t *testing.T) {
	t.Parallel()

	tbl := newRelationshipTable()

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "author", Value: &ast.Value{Kind: ast.ObjectValue}},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql, params := renderClause(t, clause)
	if !strings.Contains(
		sql,
		`EXISTS (SELECT 1 FROM "public"."authors" f WHERE "t".author_id = f.id)`,
	) {
		t.Errorf("expected EXISTS with join only and no inner predicate, got: %s", sql)
	}

	if strings.Contains(sql, " AND ") {
		t.Errorf("expected no inner predicate for empty relationship, got: %s", sql)
	}

	if len(params) != 0 {
		t.Errorf("params = %v, want none", params)
	}
}

// TestParse_NullNot covers `where: {_not: null}`. `_not` is a nested bool_exp
// position, so an explicit null is rejected, matching Hasura, which returns a
// validation error rather than treating it as a no-op.
func TestParse_NullNot(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_not", Value: &ast.Value{Kind: ast.NullValue}},
		},
	}

	_, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err == nil {
		t.Fatal("expected error for null _not, got nil")
	}

	if !strings.Contains(err.Error(), "expected object value") {
		t.Errorf("error = %v, want 'expected object value'", err)
	}
}

// TestParse_EmptyNot covers `where: {_not: {}}`. The empty inner bool_exp is
// always true, so `_not: {}` is always false. It must render the `false`
// constant (Hasura returns no rows) -- never the invalid `NOT ()` fragment.
func TestParse_EmptyNot(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_not", Value: &ast.Value{Kind: ast.ObjectValue}},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql, params := renderClause(t, clause)
	if sql != "false" {
		t.Errorf("Parse(_not: {}) rendered %q, want \"false\"", sql)
	}

	if len(params) != 0 {
		t.Errorf("params = %v, want none", params)
	}
}

// TestParse_EmptyOr covers `where: {_or: []}`. An empty disjunction is false,
// matching Hasura (no rows); it must render the `false` constant, not the
// invalid empty `()` fragment.
func TestParse_EmptyOr(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_or", Value: &ast.Value{Kind: ast.ListValue}},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql, params := renderClause(t, clause)
	if sql != "false" {
		t.Errorf("Parse(_or: []) rendered %q, want \"false\"", sql)
	}

	if len(params) != 0 {
		t.Errorf("params = %v, want none", params)
	}
}

// TestParse_OrWithEmptyElement covers `where: {_or: [{}]}`. An empty bool_exp
// element is always true, so the disjunction is true; it must render `(true)`,
// matching Hasura (all rows), rather than an invalid empty `()` element.
func TestParse_OrWithEmptyElement(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_or", Value: &ast.Value{
				Kind:     ast.ListValue,
				Children: []*ast.ChildValue{{Value: &ast.Value{Kind: ast.ObjectValue}}},
			}},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql, params := renderClause(t, clause)
	if sql != "(true)" {
		t.Errorf("Parse(_or: [{}]) rendered %q, want \"(true)\"", sql)
	}

	if len(params) != 0 {
		t.Errorf("params = %v, want none", params)
	}
}

// TestParse_NotOfEmptyOr covers `where: {_not: {_or: []}}`. The inner `_or: []`
// is false, so its negation is true; it must render `NOT (false)`, matching
// Hasura (all rows).
func TestParse_NotOfEmptyOr(t *testing.T) {
	t.Parallel()

	tbl := &parseTestTable{}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{Name: "_not", Value: &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: "_or", Value: &ast.Value{Kind: ast.ListValue}},
				},
			}},
		},
	}

	clause, err := where.Parse(tbl, value, nil, "", nil, 0, where.QueryAliases)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	sql, params := renderClause(t, clause)
	if sql != "NOT (false)" {
		t.Errorf("Parse(_not: {_or: []}) rendered %q, want \"NOT (false)\"", sql)
	}

	if len(params) != 0 {
		t.Errorf("params = %v, want none", params)
	}
}

func assertNullLogicalCombinatorRejected(t *testing.T, fieldName string) {
	t.Helper()

	tbl := &parseTestTable{}

	tests := []struct {
		name      string
		child     *ast.Value
		variables map[string]any
	}{
		{
			name:  "literal null",
			child: &ast.Value{Kind: ast.NullValue},
		},
		{
			name:      "variable resolving to null",
			child:     &ast.Value{Kind: ast.Variable, Raw: "conds"},
			variables: map[string]any{"conds": nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			value := &ast.Value{
				Kind: ast.ObjectValue,
				Children: []*ast.ChildValue{
					{Name: fieldName, Value: tt.child},
				},
			}

			_, err := where.Parse(tbl, value, tt.variables, "", nil, 0, where.QueryAliases)
			if err == nil {
				t.Fatalf("expected error for null %s, got nil", fieldName)
			}
		})
	}
}

// TestParse_NullAnd covers `where: {_and: null}` and `_and: $conds` with a
// null variable. Unlike top-level where, `_and` does not treat null as an
// omitted filter: parseLogicalAnd resolves the child value and then rejects
// NullValue because it is neither a list nor an object. This pins the behavior
// preserved by whole-list variable resolution.
func TestParse_NullAnd(t *testing.T) {
	t.Parallel()

	assertNullLogicalCombinatorRejected(t, "_and")
}

// TestParse_NullOr covers `where: {_or: null}` and `_or: $conds` with a null
// variable. Like `_and`, parseLogicalOr resolves the child value and then
// rejects NullValue because it is neither a list nor an object, matching
// Hasura's "expected a list, but found null".
func TestParse_NullOr(t *testing.T) {
	t.Parallel()

	assertNullLogicalCombinatorRejected(t, "_or")
}

// TestParseFieldComparison_Regex_Supported exercises the SupportsRegex=true
// happy path through the operator dispatch table: the regex operator parser
// emits a Postgres regex predicate and the placeholder is taken from the
// dialect's Placeholder method.
func TestParseFieldComparison_Regex_Supported(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().SupportsRegex().Return(true)
	d.EXPECT().Placeholder(1).Return("$1")

	col := &core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_regex",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "^foo"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `"name" ~ $1`) {
		t.Errorf("SQL should contain `\"name\" ~ $1`, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "^foo" {
		t.Errorf("params = %v, want [^foo]", params)
	}
}

// TestParseFieldComparison_Regex_Unsupported pins the SupportsRegex=false
// error path on buildRegex — defence in depth against a caller that bypasses
// the schema-level filter that strips _regex from non-Postgres input types.
func TestParseFieldComparison_Regex_Unsupported(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().SupportsRegex().Return(false)

	col := &core.Column{SQLName: "name", GraphqlName: "name", SQLType: "text"}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_regex",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "^foo"},
			},
		},
	}

	_, _, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err == nil {
		t.Fatal("expected error from SupportsRegex=false, got nil")
	}

	if !strings.Contains(err.Error(), "regex operators are not supported") {
		t.Errorf("error %q should explain the SupportsRegex gate", err)
	}
}

func TestParseFieldComparison_STIntersects(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "geometry").Return("$1::geometry")

	col := &core.Column{
		SQLName:     "geom",
		GraphqlName: "geom",
		SQLType:     "geometry",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name:  "_st_intersects",
				Value: &ast.Value{Kind: ast.StringValue, Raw: "POINT(1 1)"},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `ST_Intersects("t"."geom", $1::geometry)`) {
		t.Errorf("SQL should contain ST_Intersects, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "POINT(1 1)" {
		t.Errorf("params = %v, want [POINT(1 1)]", params)
	}
}

func TestParseFieldComparison_STDWithin(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "geography").Return("$1::geography")
	d.EXPECT().Placeholder(2).Return("$2")
	d.EXPECT().TypeCast("$2", "float8").Return("$2::float8")
	d.EXPECT().Placeholder(3).Return("$3")
	d.EXPECT().TypeCast("$3", "boolean").Return("$3::boolean")

	col := &core.Column{
		SQLName:     "geog",
		GraphqlName: "geog",
		SQLType:     "geography",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_st_d_within",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{
							Name:  "from",
							Value: &ast.Value{Kind: ast.StringValue, Raw: "POINT(2 2)"},
						},
						{
							Name:  "distance",
							Value: &ast.Value{Kind: ast.FloatValue, Raw: "1000"},
						},
						{
							Name:  "use_spheroid",
							Value: &ast.Value{Kind: ast.BooleanValue, Raw: "false"},
						},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `ST_DWithin("t"."geog", $1::geography, $2::float8, $3::boolean)`) {
		t.Errorf("SQL should contain ST_DWithin, got: %s", sql)
	}

	if len(params) != 3 || params[0] != "POINT(2 2)" || params[1] != 1000.0 || params[2] != false {
		t.Errorf("params = %v", params)
	}
}

func TestParseFieldComparison_Cast(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	d := dialectmock.NewMockDialect(ctrl)
	d.EXPECT().Placeholder(1).Return("$1")
	d.EXPECT().TypeCast("$1", "geometry").Return("$1::geometry")

	col := &core.Column{
		SQLName:     "geog",
		GraphqlName: "geog",
		SQLType:     "geography",
		IsArray:     false,
	}

	value := &ast.Value{
		Kind: ast.ObjectValue,
		Children: []*ast.ChildValue{
			{
				Name: "_cast",
				Value: &ast.Value{
					Kind: ast.ObjectValue,
					Children: []*ast.ChildValue{
						{
							Name: "geometry",
							Value: &ast.Value{
								Kind: ast.ObjectValue,
								Children: []*ast.ChildValue{
									{
										Name:  "_st_intersects",
										Value: &ast.Value{Kind: ast.StringValue, Raw: "POINT(1 1)"},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	sql, params, err := runParseFieldComparison(
		t,
		&stubTableForFieldComparison{d: d},
		col,
		value,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !strings.Contains(sql, `ST_Intersects(("t"."geog")::geometry, $1::geometry)`) {
		t.Errorf("SQL should contain cast expression, got: %s", sql)
	}

	if len(params) != 1 || params[0] != "POINT(1 1)" {
		t.Errorf("params = %v", params)
	}
}

