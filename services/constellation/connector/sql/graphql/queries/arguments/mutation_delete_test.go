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
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

func TestParseDelete(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil)

		args := ast.ArgumentList{
			&ast.Argument{Name: "where", Value: objectValue()},
		}

		got, err := arguments.ParseDelete(tbl, args, nil, "user", nil)
		if err != nil {
			t.Fatalf("ParseDelete: %v", err)
		}

		if got == nil {
			t.Error("expected non-nil clause")
		}
	})

	t.Run("no where returns nil clause", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		got, err := arguments.ParseDelete(tbl, ast.ArgumentList{}, nil, "user", nil)
		if err != nil {
			t.Fatalf("ParseDelete: %v", err)
		}

		if got != nil {
			t.Errorf("expected nil clause, got %v", got)
		}
	})

	t.Run("unexpected argument rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "bogus", Value: intValue("1")},
		}

		_, err := arguments.ParseDelete(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error for unexpected argument")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
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

		_, err := arguments.ParseDelete(tbl, args, nil, "user", nil)
		if err == nil || !errors.Is(err, sentinel) {
			t.Fatalf("expected wrapped sentinel, got %v", err)
		}
	})
}

func TestParseDeleteByPk(t *testing.T) {
	t.Parallel()

	t.Run("composite primary key", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		pkA := newColumn("a", "a", "uuid")
		pkB := newColumn("b", "b", "int")
		tbl.EXPECT().PKColumns().Return([]*core.Column{pkA, pkB})
		tbl.EXPECT().Dialect().Return(pgDialect()).Times(2)

		args := ast.ArgumentList{
			&ast.Argument{Name: "a", Value: stringValue("x")},
			&ast.Argument{Name: "b", Value: intValue("42")},
		}

		clause, err := arguments.ParseDeleteByPk(tbl, args, nil)
		if err != nil {
			t.Fatalf("ParseDeleteByPk: %v", err)
		}

		var b strings.Builder

		params, _, werr := clause.WriteCondition(&b, `"t"`, nil, 1)
		if werr != nil {
			t.Fatalf("WriteCondition: %v", werr)
		}

		sql := b.String()
		if !strings.Contains(sql, `"t"."a" = $1::uuid`) ||
			!strings.Contains(sql, `"t"."b" = $2::int`) {
			t.Errorf("missing pk conditions: %q", sql)
		}

		if len(params) != 2 || params[0] != "x" || params[1] != int64(42) {
			t.Errorf("params=%v want=[x 42]", params)
		}
	})

	t.Run("missing pk argument", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().PKColumns().Return([]*core.Column{newColumn("id", "id", "uuid")})

		_, err := arguments.ParseDeleteByPk(tbl, ast.ArgumentList{}, nil)
		if err == nil {
			t.Fatal("expected error for missing pk arg")
		}
	})

	t.Run("variable resolution failure", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().PKColumns().Return([]*core.Column{newColumn("id", "id", "uuid")})

		args := ast.ArgumentList{
			&ast.Argument{Name: "id", Value: variableValue("missing")},
		}

		_, err := arguments.ParseDeleteByPk(tbl, args, map[string]any{})
		if err == nil {
			t.Fatal("expected error for missing variable")
		}
	})
}
