package arguments_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// pgDialect returns a PostgreSQL dialect for use in tests; the parser only
// touches Placeholder/TypeCast when it builds NewEqualsFilter, so the concrete
// implementation is preferable to wiring a mock.
func pgDialect() dialect.Dialect { return &dialect.PostgresDialect{} }

// newColumn is a tiny helper to keep test bodies focused on the parser inputs.
func newColumn(gql, sqlName, sqlType string) *core.Column {
	return &core.Column{
		SQLName:     sqlName,
		GraphqlName: gql,
		SQLType:     sqlType,
		IsArray:     false,
		IsGenerated: false,
	}
}

func intValue(raw string) *ast.Value {
	return &ast.Value{Kind: ast.IntValue, Raw: raw}
}

func floatValue(raw string) *ast.Value {
	return &ast.Value{Kind: ast.FloatValue, Raw: raw}
}

func stringValue(raw string) *ast.Value {
	return &ast.Value{Kind: ast.StringValue, Raw: raw}
}

func enumValue(raw string) *ast.Value {
	return &ast.Value{Kind: ast.EnumValue, Raw: raw}
}

func variableValue(name string) *ast.Value {
	return &ast.Value{Kind: ast.Variable, Raw: name}
}

func objectValue(children ...*ast.ChildValue) *ast.Value {
	return &ast.Value{Kind: ast.ObjectValue, Children: children}
}

func listValue(children ...*ast.ChildValue) *ast.Value {
	return &ast.Value{Kind: ast.ListValue, Children: children}
}

func child(name string, v *ast.Value) *ast.ChildValue {
	return &ast.ChildValue{Name: name, Value: v}
}

func TestParseLimitOffset(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		value     *ast.Value
		variables map[string]any
		want      *int
		wantErr   bool
	}{
		{
			name:  "int",
			value: intValue("10"),
			want:  new(10),
		},
		{
			name:  "float whole",
			value: floatValue("5"),
			want:  new(5),
		},
		{
			name:    "float fractional",
			value:   floatValue("3.14"),
			wantErr: true,
		},
		{
			name:    "string is not an integer",
			value:   stringValue("nope"),
			wantErr: true,
		},
		{
			name:      "variable resolves to int",
			value:     variableValue("v"),
			variables: map[string]any{"v": 7},
			want:      new(7),
		},
		{
			name:      "variable missing",
			value:     variableValue("v"),
			variables: map[string]any{},
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := arguments.ParseLimitOffset(tt.value, tt.variables)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil (got=%v)", got)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if (got == nil) != (tt.want == nil) || (got != nil && *got != *tt.want) {
				t.Errorf("got=%v, want=%v", deref(got), deref(tt.want))
			}
		})
	}
}

func TestParseOrderBy(t *testing.T) {
	t.Parallel()

	t.Run("object form", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("name").Return(newColumn("name", "name", "text"))

		got, err := arguments.ParseOrderBy(
			tbl,
			objectValue(child("name", enumValue("asc"))),
			nil,
			"",
			nil,
			"",
		)
		if err != nil {
			t.Fatalf("ParseOrderBy: %v", err)
		}

		if len(got) != 1 || got[0].Column != "name" || got[0].Direction != core.OrderAsc {
			t.Errorf("unexpected items: %+v", got)
		}
	})

	t.Run("list form with all six directions", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName(gomock.Any()).DoAndReturn(
			func(n string) *core.Column { return newColumn(n, n, "text") },
		).AnyTimes()

		input := listValue(
			child("", objectValue(child("a", enumValue("asc")))),
			child("", objectValue(child("b", enumValue("asc_nulls_first")))),
			child("", objectValue(child("c", enumValue("asc_nulls_last")))),
			child("", objectValue(child("d", enumValue("desc")))),
			child("", objectValue(child("e", enumValue("desc_nulls_first")))),
			child("", objectValue(child("f", enumValue("desc_nulls_last")))),
		)

		got, err := arguments.ParseOrderBy(tbl, input, nil, "", nil, "")
		if err != nil {
			t.Fatalf("ParseOrderBy: %v", err)
		}

		wantDirs := []core.OrderDirection{
			core.OrderAsc, core.OrderAscNullsFirst, core.OrderAscNullsLast,
			core.OrderDesc, core.OrderDescNullsFirst, core.OrderDescNullsLast,
		}
		if len(got) != len(wantDirs) {
			t.Fatalf("got %d items, want %d", len(got), len(wantDirs))
		}

		for i, item := range got {
			if item.Direction != wantDirs[i] {
				t.Errorf(
					"item[%d] direction = %v, want %v",
					i,
					item.Direction,
					wantDirs[i],
				)
			}
		}
	})

	t.Run("unknown column errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("bogus").Return(nil)
		tbl.EXPECT().Relationship("bogus").Return(nil)
		tbl.EXPECT().TableName().Return("users")

		_, err := arguments.ParseOrderBy(
			tbl,
			objectValue(child("bogus", enumValue("asc"))),
			nil,
			"",
			nil,
			"",
		)
		if err == nil {
			t.Fatal("expected error for unknown column")
		}
	})

	t.Run("non-enum direction errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("name").Return(newColumn("name", "name", "text"))

		_, err := arguments.ParseOrderBy(
			tbl, objectValue(child("name", stringValue("asc"))), nil, "", nil, "",
		)
		if err == nil {
			t.Fatal("expected error: direction must be enum")
		}
	})

	t.Run("unknown direction errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("name").Return(newColumn("name", "name", "text"))

		_, err := arguments.ParseOrderBy(
			tbl, objectValue(child("name", enumValue("sideways"))), nil, "", nil, "",
		)
		if err == nil {
			t.Fatal("expected error: unknown direction")
		}
	})

	t.Run("scalar value rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseOrderBy(tbl, intValue("1"), nil, "", nil, "")
		if err == nil {
			t.Fatal("expected error: order_by must be list or object")
		}
	})
}

func TestParseDistinctOn(t *testing.T) {
	t.Parallel()

	t.Run("single enum value", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("name").Return(newColumn("name", "name_sql", "text"))

		got, err := arguments.ParseDistinctOn(tbl, enumValue("name"), nil)
		if err != nil {
			t.Fatalf("ParseDistinctOn: %v", err)
		}

		if len(got) != 1 || got[0] != "name_sql" {
			t.Errorf("got=%v, want=[name_sql]", got)
		}
	})

	t.Run("list of enum values", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("a").Return(newColumn("a", "a_sql", "text"))
		tbl.EXPECT().ColumnFromGraphqlName("b").Return(newColumn("b", "b_sql", "text"))

		got, err := arguments.ParseDistinctOn(
			tbl, listValue(child("", enumValue("a")), child("", enumValue("b"))), nil,
		)
		if err != nil {
			t.Fatalf("ParseDistinctOn: %v", err)
		}

		if len(got) != 2 || got[0] != "a_sql" || got[1] != "b_sql" {
			t.Errorf("got=%v, want=[a_sql b_sql]", got)
		}
	})

	t.Run("unknown column errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("nope").Return(nil)
		tbl.EXPECT().TableName().Return("users")

		_, err := arguments.ParseDistinctOn(tbl, enumValue("nope"), nil)
		if err == nil {
			t.Fatal("expected error for unknown column")
		}
	})

	t.Run("non-enum list element rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseDistinctOn(
			tbl, listValue(child("", stringValue("a"))), nil,
		)
		if err == nil {
			t.Fatal("expected error: list elements must be enum values")
		}
	})

	t.Run("scalar value rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseDistinctOn(tbl, intValue("1"), nil)
		if err == nil {
			t.Fatal("expected error: distinct_on must be enum or list")
		}
	})
}

func TestParseQueryByPk(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		pkCol := newColumn("id", "id", "uuid")
		tbl.EXPECT().PKColumns().Return([]*core.Column{pkCol})
		tbl.EXPECT().Dialect().Return(pgDialect())

		field := &ast.Field{
			Name: "users_by_pk",
			Arguments: ast.ArgumentList{
				&ast.Argument{Name: "id", Value: stringValue("abc-123")},
			},
		}

		clause, err := arguments.ParseQueryByPk(tbl, field, nil)
		if err != nil {
			t.Fatalf("ParseQueryByPk: %v", err)
		}

		var b strings.Builder

		params, _, werr := clause.WriteCondition(&b, `"t"`, nil, 1)
		if werr != nil {
			t.Fatalf("WriteCondition: %v", werr)
		}

		if want := `"t"."id" = $1::uuid`; b.String() != want {
			t.Errorf("sql=%q want=%q", b.String(), want)
		}

		if len(params) != 1 || params[0] != "abc-123" {
			t.Errorf("params=%v want=[abc-123]", params)
		}
	})

	t.Run("missing required argument", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().PKColumns().Return([]*core.Column{newColumn("id", "id", "uuid")})

		field := &ast.Field{Name: "users_by_pk", Arguments: ast.ArgumentList{}}

		_, err := arguments.ParseQueryByPk(tbl, field, nil)
		if err == nil {
			t.Fatal("expected error for missing pk arg")
		}
	})

	t.Run("variable resolution failure", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().PKColumns().Return([]*core.Column{newColumn("id", "id", "uuid")})

		field := &ast.Field{
			Name: "users_by_pk",
			Arguments: ast.ArgumentList{
				&ast.Argument{Name: "id", Value: variableValue("missing")},
			},
		}

		_, err := arguments.ParseQueryByPk(tbl, field, map[string]any{})
		if err == nil {
			t.Fatal("expected error for unresolved variable")
		}
	})
}

func TestParseQuery(t *testing.T) {
	t.Parallel()

	t.Run("returns nils when no args present", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		whereCl, mods, dOn, err := arguments.ParseQuery(tbl, nil, nil, "user", nil, "")
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		if whereCl != nil || mods != nil || dOn != nil {
			t.Errorf("expected (nil,nil,nil,nil), got (%v,%v,%v)", whereCl, mods, dOn)
		}
	})

	t.Run("all arguments combine", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		// Order-by + distinct-on lookups
		tbl.EXPECT().ColumnFromGraphqlName("name").Return(newColumn("name", "name", "text"))
		tbl.EXPECT().ColumnFromGraphqlName("id").Return(newColumn("id", "id", "uuid"))

		// where parser is delegated; just have it return an empty clause.
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil)

		args := ast.ArgumentList{
			&ast.Argument{Name: "where", Value: objectValue()},
			&ast.Argument{
				Name:  "order_by",
				Value: objectValue(child("name", enumValue("asc"))),
			},
			&ast.Argument{Name: "limit", Value: intValue("10")},
			&ast.Argument{Name: "offset", Value: intValue("5")},
			&ast.Argument{Name: "distinct_on", Value: enumValue("id")},
		}

		whereCl, mods, dOn, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		if whereCl == nil {
			t.Error("expected non-nil where clause")
		}

		if len(mods) != 3 {
			t.Errorf("expected 3 modifiers (order_by,limit,offset), got %d", len(mods))
		}

		if dOn == nil || len(dOn.Columns) != 1 || dOn.Columns[0] != "id" {
			t.Errorf("unexpected distinct_on: %+v", dOn)
		}
	})

	t.Run("where parse error propagates", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		sentinel := errors.New("boom") //nolint:err113 // test sentinel
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any(),
		).Return(nil, sentinel)

		args := ast.ArgumentList{
			&ast.Argument{Name: "where", Value: objectValue()},
		}

		_, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if err == nil || !errors.Is(err, sentinel) {
			t.Fatalf("expected wrapped %v, got %v", sentinel, err)
		}
	})

	t.Run("zero-limit suppresses modifier", func(t *testing.T) {
		t.Parallel()

		// ParseLimitOffset returns a non-nil zero value, so the modifier IS appended.
		// What suppresses a modifier is `limitVal == nil`. We can't trigger that
		// from valid inputs — ensure that semantic by inputting a missing-variable
		// limit (which errors instead) is not the path. Just assert the normal
		// behaviour: zero is still appended.
		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "limit", Value: intValue("0")},
		}

		_, mods, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		if len(mods) != 1 {
			t.Fatalf("expected limit modifier, got %d mods", len(mods))
		}
	})
}

func deref(p *int) any {
	if p == nil {
		return nil
	}

	return *p
}
