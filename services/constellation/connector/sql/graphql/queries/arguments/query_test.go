package arguments_test

import (
	"errors"
	"fmt"
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

// wantDistinctOnOrderByMismatchMessage is the exact client-facing message
// Hasura emits for a distinct_on/order_by mismatch. It is hardcoded here (not
// read from an arguments symbol) so the assertion pins the byte-for-byte
// Hasura-parity wire message independently of the package internals, mirroring
// how the negative-limit validation test asserts its literal.
const wantDistinctOnOrderByMismatchMessage = `"distinct_on" columns must match initial "order_by" columns`

// distinctOnOrderByMismatchError builds a real *QueryValidationError by driving
// the public ParseQuery with a distinct_on that does not match the leading
// order_by, so tests exercise the production validation path instead of a
// hand-minted error. The order_by references budget while distinct_on
// references name, which ParseQuery rejects.
func distinctOnOrderByMismatchError(t *testing.T) *arguments.QueryValidationError {
	t.Helper()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)
	tbl.EXPECT().ColumnFromGraphqlName("budget").
		Return(newColumn("budget", "budget", "numeric"))
	tbl.EXPECT().ColumnFromGraphqlName("name").
		Return(newColumn("name", "name", "text"))

	args := ast.ArgumentList{
		&ast.Argument{
			Name:  "order_by",
			Value: objectValue(child("budget", enumValue("desc"))),
		},
		&ast.Argument{Name: "distinct_on", Value: enumValue("name")},
	}

	clause, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
	if clause != nil {
		t.Fatalf("ParseQuery: expected nil where clause on the error path, got %v", clause)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("ParseQuery: expected a *QueryValidationError, got %T (%v)", err, err)
	}

	return vErr
}

func TestParseLimitOffset(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		value     *ast.Value
		variables map[string]any
		want      *int
		wantErr   bool
		// wantErrIs, when non-nil, additionally asserts the returned error
		// wraps this sentinel (used to pin the validation-error class).
		wantErrIs error
	}{
		{
			name:      "int",
			value:     intValue("10"),
			want:      new(10),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "zero",
			value:     intValue("0"),
			want:      new(0),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "float whole",
			value:     floatValue("5"),
			want:      new(5),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "float fractional",
			value:     floatValue("3.14"),
			want:      nil,
			wantErr:   true,
			wantErrIs: arguments.ErrInvalidArgument,
		},
		{
			name:      "string is not an integer",
			value:     stringValue("nope"),
			want:      nil,
			wantErr:   true,
			wantErrIs: arguments.ErrInvalidArgument,
		},
		{
			name:      "negative int",
			value:     intValue("-1"),
			want:      new(-1),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "negative float whole",
			value:     floatValue("-1.0"),
			want:      new(-1),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "variable resolves to int",
			value:     variableValue("v"),
			variables: map[string]any{"v": 7},
			want:      new(7),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "variable resolves to negative int",
			value:     variableValue("v"),
			variables: map[string]any{"v": -5},
			want:      new(-5),
			wantErr:   false,
			wantErrIs: nil,
		},
		{
			name:      "variable missing",
			value:     variableValue("v"),
			variables: map[string]any{},
			want:      nil,
			wantErr:   true,
			wantErrIs: nil,
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

				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Fatalf("expected error wrapping %v, got %v", tt.wantErrIs, err)
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

		// Order-by + distinct-on lookups. distinct_on must be the leading
		// order_by column (Hasura's rule) or ParseQuery rejects, so both
		// reference id here.
		tbl.EXPECT().ColumnFromGraphqlName("id").
			Return(newColumn("id", "id", "uuid")).Times(2)

		// where parser is delegated; just have it return an empty clause.
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil)

		args := ast.ArgumentList{
			&ast.Argument{Name: "where", Value: objectValue()},
			&ast.Argument{
				Name:  "order_by",
				Value: objectValue(child("id", enumValue("asc"))),
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

func parseNegativeQueryArgument(t *testing.T, argName string) error {
	t.Helper()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)

	args := ast.ArgumentList{
		&ast.Argument{Name: argName, Value: intValue("-1")},
	}

	clause, modifiers, distinctOn, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
	if clause != nil {
		t.Fatalf("expected nil where clause on the error path, got %v", clause)
	}

	if len(modifiers) != 0 {
		t.Fatalf("expected no query modifiers on the error path, got %d", len(modifiers))
	}

	if distinctOn != nil {
		t.Fatalf("expected nil distinct_on on the error path, got %v", distinctOn)
	}

	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Fatalf("expected ErrInvalidArgument, got %v", err)
	}

	return fmt.Errorf("parse negative %s: %w", argName, err)
}

func TestParseQueryNegativeLimitValidationError(t *testing.T) {
	t.Parallel()

	err := parseNegativeQueryArgument(t, "limit")

	var dataErr *arguments.DataExceptionError
	if errors.As(err, &dataErr) {
		t.Fatalf("negative limit returned DataExceptionError: %v", dataErr)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("expected a *QueryValidationError, got %T", err)
	}

	vErr.StampArgumentPath("departments")

	got := vErr.AsMap()

	wantMessage := "expected a non-negative 32-bit integer for type 'Int', but found an integer"
	if got["message"] != wantMessage {
		t.Errorf("message: got %q, want %q", got["message"], wantMessage)
	}

	ext, ok := got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions: got %T, want map[string]any", got["extensions"])
	}

	if ext["code"] != "validation-failed" {
		t.Errorf("extensions.code: got %v, want validation-failed", ext["code"])
	}

	if ext["path"] != "$.selectionSet.departments.args.limit" {
		t.Errorf("extensions.path: got %v, want negative-limit argument path", ext["path"])
	}
}

func TestParseQueryNegativeLimitVariableValidationError(t *testing.T) {
	t.Parallel()

	args := ast.ArgumentList{
		&ast.Argument{Name: "limit", Value: variableValue("limit")},
	}

	clause, modifiers, distinctOn, err := arguments.ParseQuery(
		nil,
		args,
		map[string]any{"limit": -1.0},
		"user",
		nil,
		"",
	)
	if clause != nil {
		t.Fatalf("expected nil where clause on the error path, got %v", clause)
	}

	if len(modifiers) != 0 {
		t.Fatalf("expected no query modifiers on the error path, got %d", len(modifiers))
	}

	if distinctOn != nil {
		t.Fatalf("expected nil distinct_on on the error path, got %v", distinctOn)
	}

	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Fatalf("expected ErrInvalidArgument, got %v", err)
	}

	var vErr *arguments.QueryValidationError
	if !errors.As(err, &vErr) {
		t.Fatalf("expected a *QueryValidationError, got %T", err)
	}

	got := vErr.AsMap()

	wantMessage := "expected a non-negative 32-bit integer for type 'Int', but found a number"
	if got["message"] != wantMessage {
		t.Errorf("message: got %q, want %q", got["message"], wantMessage)
	}
}

func TestParseQueryNegativeOffsetDataExceptionError(t *testing.T) {
	t.Parallel()

	err := parseNegativeQueryArgument(t, "offset")

	var vErr *arguments.QueryValidationError
	if errors.As(err, &vErr) {
		t.Fatalf("negative offset returned validation-failed error: %v", vErr.AsMap())
	}

	var dataErr *arguments.DataExceptionError
	if !errors.As(err, &dataErr) {
		t.Fatalf("expected a *DataExceptionError, got %T", err)
	}

	got := dataErr.AsMap()
	if got["message"] != "OFFSET must not be negative" {
		t.Errorf("message: got %q, want negative-offset Hasura message", got["message"])
	}

	ext, ok := got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions: got %T, want map[string]any", got["extensions"])
	}

	if ext["code"] != "data-exception" {
		t.Errorf("extensions.code: got %v, want data-exception", ext["code"])
	}

	if ext["path"] != "$" {
		t.Errorf("extensions.path: got %v, want $", ext["path"])
	}
}

// TestParseQueryDistinctOnOrderByValidation covers ParseQuery's validation of
// the distinct_on / order_by combination so it matches Hasura exactly: inject a
// leading ORDER BY when none was given, allow an order_by whose leading prefix
// contains the distinct_on columns (in any order), and reject any other order_by
// with the Hasura distinct_on/order_by mismatch message (wrapping
// ErrInvalidArgument) instead of silently reconciling it.
func TestParseQueryDistinctOnOrderByValidation(t *testing.T) {
	t.Parallel()

	t.Run("distinct_on with mismatched order_by is rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		// order_by references budget; distinct_on references name (different col).
		tbl.EXPECT().ColumnFromGraphqlName("budget").
			Return(newColumn("budget", "budget", "numeric"))
		tbl.EXPECT().ColumnFromGraphqlName("name").
			Return(newColumn("name", "name", "text"))

		args := ast.ArgumentList{
			&ast.Argument{
				Name:  "order_by",
				Value: objectValue(child("budget", enumValue("desc"))),
			},
			&ast.Argument{Name: "distinct_on", Value: enumValue("name")},
		}

		_, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Fatalf("expected ErrInvalidArgument, got %v", err)
		}

		var vErr *arguments.QueryValidationError
		if !errors.As(err, &vErr) {
			t.Fatalf("expected a *QueryValidationError, got %T", err)
		}

		vErr.StampArgumentPath("departments")

		if got := vErr.AsMap()["message"]; got != wantDistinctOnOrderByMismatchMessage {
			t.Fatalf(
				"message: got %q, want %q",
				got,
				wantDistinctOnOrderByMismatchMessage,
			)
		}
	})

	t.Run("multi-column distinct_on with non-matching order_by prefix is rejected",
		func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)

			// order_by leads with created_at (a non-distinct column); distinct_on
			// is [disabled, email_verified]. The distinct columns are not the
			// leading order_by columns, so Hasura (and now ParseQuery) rejects.
			tbl.EXPECT().ColumnFromGraphqlName("createdAt").
				Return(newColumn("createdAt", "created_at", "timestamptz"))
			tbl.EXPECT().ColumnFromGraphqlName("id").
				Return(newColumn("id", "id", "uuid"))
			tbl.EXPECT().ColumnFromGraphqlName("disabled").
				Return(newColumn("disabled", "disabled", "boolean"))
			tbl.EXPECT().ColumnFromGraphqlName("emailVerified").
				Return(newColumn("emailVerified", "email_verified", "boolean"))

			args := ast.ArgumentList{
				&ast.Argument{
					Name: "order_by",
					Value: listValue(
						child("", objectValue(child("createdAt", enumValue("desc")))),
						child("", objectValue(child("id", enumValue("asc")))),
					),
				},
				&ast.Argument{
					Name: "distinct_on",
					Value: listValue(
						child("", enumValue("disabled")),
						child("", enumValue("emailVerified")),
					),
				},
			}

			_, _, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
			if !errors.Is(err, arguments.ErrInvalidArgument) {
				t.Fatalf("expected ErrInvalidArgument, got %v", err)
			}

			var vErr *arguments.QueryValidationError
			if !errors.As(err, &vErr) {
				t.Fatalf("expected a *QueryValidationError, got %T", err)
			}

			if got := vErr.AsMap()["message"]; got != wantDistinctOnOrderByMismatchMessage {
				t.Fatalf(
					"message: got %q, want %q",
					got,
					wantDistinctOnOrderByMismatchMessage,
				)
			}
		})

	t.Run("distinct_on without order_by synthesises leading order_by", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().ColumnFromGraphqlName("locale").
			Return(newColumn("locale", "locale", "text"))

		args := ast.ArgumentList{
			&ast.Argument{Name: "distinct_on", Value: enumValue("locale")},
		}

		_, mods, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		ob := firstOrderBy(t, mods)
		assertOrderByItems(t, ob.Items, []arguments.OrderByItem{
			{Column: "locale", Direction: core.OrderAscNullsLast},
		})
	})

	t.Run("distinct_on matching the leading order_by columns is allowed", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		// order_by: [{name: asc}, {budget: desc}], distinct_on: [name, budget].
		tbl.EXPECT().ColumnFromGraphqlName("name").
			Return(newColumn("name", "name", "text")).Times(2)
		tbl.EXPECT().ColumnFromGraphqlName("budget").
			Return(newColumn("budget", "budget", "numeric")).Times(2)

		args := ast.ArgumentList{
			&ast.Argument{
				Name: "order_by",
				Value: listValue(
					child("", objectValue(child("name", enumValue("asc")))),
					child("", objectValue(child("budget", enumValue("desc")))),
				),
			},
			&ast.Argument{
				Name: "distinct_on",
				Value: listValue(
					child("", enumValue("name")),
					child("", enumValue("budget")),
				),
			},
		}

		_, mods, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
		if err != nil {
			t.Fatalf("ParseQuery: %v", err)
		}

		ob := firstOrderBy(t, mods)
		// The distinct columns already lead the order_by, so the order_by is
		// left untouched: the user's directions are preserved and nothing is
		// duplicated or reordered.
		assertOrderByItems(t, ob.Items, []arguments.OrderByItem{
			{Column: "name", Direction: core.OrderAsc},
			{Column: "budget", Direction: core.OrderDesc},
		})
	})

	t.Run("distinct_on columns may appear in any order within the order_by prefix",
		func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)

			// PostgreSQL/Hasura require the first N order_by columns to be the
			// distinct_on columns, but those first N columns may be permuted.
			tbl.EXPECT().ColumnFromGraphqlName("emailVerified").
				Return(newColumn("emailVerified", "email_verified", "boolean")).Times(2)
			tbl.EXPECT().ColumnFromGraphqlName("disabled").
				Return(newColumn("disabled", "disabled", "boolean")).Times(2)
			tbl.EXPECT().ColumnFromGraphqlName("id").
				Return(newColumn("id", "id", "uuid"))

			args := ast.ArgumentList{
				&ast.Argument{
					Name: "order_by",
					Value: listValue(
						child("", objectValue(child("emailVerified", enumValue("desc")))),
						child("", objectValue(child("disabled", enumValue("asc")))),
						child("", objectValue(child("id", enumValue("asc")))),
					),
				},
				&ast.Argument{
					Name: "distinct_on",
					Value: listValue(
						child("", enumValue("disabled")),
						child("", enumValue("emailVerified")),
					),
				},
			}

			_, mods, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
			if err != nil {
				t.Fatalf("ParseQuery: %v", err)
			}

			ob := firstOrderBy(t, mods)
			assertOrderByItems(t, ob.Items, []arguments.OrderByItem{
				{Column: "email_verified", Direction: core.OrderDesc},
				{Column: "disabled", Direction: core.OrderAsc},
				{Column: "id", Direction: core.OrderAsc},
			})
		})
}

func TestParseQueryDistinctOnEmptyOrderBySynthesizesOrderBy(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		orderBy *ast.Value
	}{
		{
			name:    "empty object",
			orderBy: objectValue(),
		},
		{
			name:    "empty list",
			orderBy: listValue(),
		},
		{
			name:    "list containing empty object",
			orderBy: listValue(child("", objectValue())),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)

			tbl.EXPECT().ColumnFromGraphqlName("locale").
				Return(newColumn("locale", "locale", "text"))

			args := ast.ArgumentList{
				&ast.Argument{Name: "order_by", Value: tt.orderBy},
				&ast.Argument{Name: "distinct_on", Value: enumValue("locale")},
			}

			_, mods, _, err := arguments.ParseQuery(tbl, args, nil, "user", nil, "")
			if err != nil {
				t.Fatalf("ParseQuery: %v", err)
			}

			ob := firstOrderBy(t, mods)
			assertOrderByItems(t, ob.Items, []arguments.OrderByItem{
				{Column: "locale", Direction: core.OrderAscNullsLast},
			})
		})
	}
}

// TestQueryValidationErrorAsMap locks the GraphQL error envelope a
// *QueryValidationError renders to Hasura's exact shape: the verbatim message
// plus an extensions block with code "validation-failed" and the
// "$.selectionSet.<rootField>.args" path, and nothing else (no top-level path
// or locations).
func TestQueryValidationErrorAsMap(t *testing.T) {
	t.Parallel()

	vErr := distinctOnOrderByMismatchError(t)
	vErr.StampArgumentPath("departments")

	got := vErr.AsMap()

	if got["message"] != wantDistinctOnOrderByMismatchMessage {
		t.Errorf("message: got %q, want %q", got["message"], wantDistinctOnOrderByMismatchMessage)
	}

	if _, ok := got["path"]; ok {
		t.Errorf("unexpected top-level path key: %v", got["path"])
	}

	if _, ok := got["locations"]; ok {
		t.Errorf("unexpected locations key: %v", got["locations"])
	}

	ext, ok := got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions: got %T, want map[string]any", got["extensions"])
	}

	if ext["code"] != "validation-failed" {
		t.Errorf("extensions.code: got %v, want validation-failed", ext["code"])
	}

	if ext["path"] != "$.selectionSet.departments.args" {
		t.Errorf("extensions.path: got %v, want $.selectionSet.departments.args", ext["path"])
	}
}

func TestQueryValidationErrorRemapArgumentPath(t *testing.T) {
	t.Parallel()

	vErr := distinctOnOrderByMismatchError(t)
	vErr.StampArgumentPath("teams")

	vErr.RemapArgumentPath(func(path string) string {
		if path != "teams" {
			t.Fatalf("remapper saw path %q, want teams", path)
		}

		return "league.selectionSet.teams"
	})

	got := vErr.AsMap()

	ext, ok := got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions missing: %#v", got)
	}

	if got := ext["path"]; got != "$.selectionSet.league.selectionSet.teams.args" {
		t.Fatalf("path = %v, want remapped client path", got)
	}

	vErr.RemapArgumentPath(func(string) string { return "" })

	got = vErr.AsMap()

	ext, ok = got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions missing after empty remap: %#v", got)
	}

	if got := ext["path"]; got != "$.selectionSet.league.selectionSet.teams.args" {
		t.Fatalf("empty remap path = %v, want previous path preserved", got)
	}
}

func TestQueryValidationErrorZeroValueAsMapUsesSafeFallback(t *testing.T) {
	t.Parallel()

	vErr := new(arguments.QueryValidationError)
	vErr.StampArgumentPath("departments")

	if !errors.Is(vErr, arguments.ErrInvalidArgument) {
		t.Fatalf("expected zero-value QueryValidationError to unwrap ErrInvalidArgument")
	}

	got := vErr.AsMap()
	if got["message"] != arguments.ErrInvalidArgument.Error() {
		t.Errorf(
			"message: got %q, want %q",
			got["message"],
			arguments.ErrInvalidArgument.Error(),
		)
	}

	ext, ok := got["extensions"].(map[string]any)
	if !ok {
		t.Fatalf("extensions: got %T, want map[string]any", got["extensions"])
	}

	if ext["path"] != "$.selectionSet.departments.args" {
		t.Errorf("extensions.path: got %v, want $.selectionSet.departments.args", ext["path"])
	}
}

// firstOrderBy returns the single *OrderBy modifier in mods, failing the test
// if none (or more than one) is present.
func firstOrderBy(t *testing.T, mods []arguments.QueryModifier) *arguments.OrderBy {
	t.Helper()

	var found *arguments.OrderBy

	for _, m := range mods {
		if ob, ok := m.(*arguments.OrderBy); ok {
			if found != nil {
				t.Fatalf("expected exactly one order_by modifier, found multiple")
			}

			found = ob
		}
	}

	if found == nil {
		t.Fatalf("expected an order_by modifier, got %#v", mods)
	}

	return found
}

func assertOrderByItems(t *testing.T, got, want []arguments.OrderByItem) {
	t.Helper()

	if len(got) != len(want) {
		t.Fatalf("order_by length: got %d (%+v), want %d (%+v)",
			len(got), got, len(want), want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("order_by[%d]: got %+v, want %+v", i, got[i], want[i])
		}
	}
}

func deref(p *int) any {
	if p == nil {
		return nil
	}

	return *p
}
