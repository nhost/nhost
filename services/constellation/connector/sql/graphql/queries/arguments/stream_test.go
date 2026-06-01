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

func TestParseStream_HappyPaths(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		setupMock func(*mock.MockTable)
		args      ast.ArgumentList
		check     func(*testing.T, arguments.Stream)
	}{
		{
			name: "array cursor with explicit ASC and where",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("id").
					Return(newColumn("id", "id", "uuid"))
				tbl.EXPECT().ParseWhere(
					gomock.Any(), gomock.Any(), "user", gomock.Any(),
					0, where.QueryAliases,
				).Return(where.Clause{}, nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{Name: "batch_size", Value: intValue("100")},
				&ast.Argument{
					Name: "cursor",
					Value: listValue(child("", objectValue(
						child(
							"initial_value",
							objectValue(child("id", stringValue("abc"))),
						),
						child("ordering", enumValue("ASC")),
					))),
				},
				&ast.Argument{Name: "where", Value: objectValue()},
			},
			check: func(t *testing.T, got arguments.Stream) {
				t.Helper()

				if got.BatchSize != 100 {
					t.Errorf("BatchSize=%d want=100", got.BatchSize)
				}

				if len(got.Cursors) != 1 || got.Cursors[0].Column.SQLName != "id" ||
					got.Cursors[0].Ordering != core.OrderAsc {
					t.Errorf("unexpected cursor: %+v", got.Cursors)
				}

				if got.Where == nil {
					t.Error("expected non-nil where")
				}
			},
		},
		{
			name: "single-object cursor coerced to list, default ASC",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("id").
					Return(newColumn("id", "id", "uuid"))
			},
			args: ast.ArgumentList{
				&ast.Argument{Name: "batch_size", Value: intValue("10")},
				&ast.Argument{
					Name: "cursor",
					Value: objectValue(
						child(
							"initial_value",
							objectValue(child("id", stringValue("abc"))),
						),
					),
				},
			},
			check: func(t *testing.T, got arguments.Stream) {
				t.Helper()

				if got.Cursors[0].Ordering != core.OrderAsc {
					t.Errorf(
						"default ordering = %v, want OrderAsc",
						got.Cursors[0].Ordering,
					)
				}
			},
		},
		{
			name: "explicit DESC ordering",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("id").
					Return(newColumn("id", "id", "uuid"))
			},
			args: ast.ArgumentList{
				&ast.Argument{Name: "batch_size", Value: intValue("10")},
				&ast.Argument{
					Name: "cursor",
					Value: objectValue(
						child(
							"initial_value",
							objectValue(child("id", stringValue("abc"))),
						),
						child("ordering", enumValue("DESC")),
					),
				},
			},
			check: func(t *testing.T, got arguments.Stream) {
				t.Helper()

				if got.Cursors[0].Ordering != core.OrderDesc {
					t.Errorf(
						"ordering = %v, want OrderDesc",
						got.Cursors[0].Ordering,
					)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)

			if tt.setupMock != nil {
				tt.setupMock(tbl)
			}

			got, err := arguments.ParseStream(tbl, tt.args, nil, "user", nil)
			if err != nil {
				t.Fatalf("ParseStream: %v", err)
			}

			if tt.check != nil {
				tt.check(t, got)
			}
		})
	}
}

func TestParseStream_Errors(t *testing.T) {
	t.Parallel()

	t.Run("missing batch_size", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseStream(tbl, ast.ArgumentList{}, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("non-positive batch_size", func(t *testing.T) {
		t.Parallel()

		tests := []struct {
			name string
			raw  string
		}{
			{name: "zero", raw: "0"},
			{name: "negative", raw: "-1"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				t.Parallel()

				ctrl := gomock.NewController(t)
				tbl := mock.NewMockTable(ctrl)

				args := ast.ArgumentList{
					&ast.Argument{Name: "batch_size", Value: intValue(tt.raw)},
				}

				_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
				if err == nil {
					t.Fatal("expected error")
				}

				if !errors.Is(err, arguments.ErrInvalidArgument) {
					t.Fatalf("expected ErrInvalidArgument, got %v", err)
				}

				if !strings.Contains(err.Error(), "batch_size must be a positive integer") {
					t.Fatalf("expected batch_size message, got %v", err)
				}

				if strings.Contains(err.Error(), "limit/offset") {
					t.Fatalf("expected no limit/offset wording, got %v", err)
				}
			})
		}
	})

	t.Run("missing cursor", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "batch_size", Value: intValue("10")},
		}

		_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("missing initial_value", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "batch_size", Value: intValue("10")},
			&ast.Argument{Name: "cursor", Value: objectValue()},
		}

		_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("invalid ordering enum", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		cursor := objectValue(
			child("initial_value", objectValue(child("id", stringValue("abc")))),
			child("ordering", enumValue("SIDEWAYS")),
		)

		args := ast.ArgumentList{
			&ast.Argument{Name: "batch_size", Value: intValue("10")},
			&ast.Argument{Name: "cursor", Value: cursor},
		}

		_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error")
		}
	})

	t.Run("non-enum non-string ordering rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		cursor := objectValue(
			child("initial_value", objectValue(child("id", stringValue("abc")))),
			child("ordering", intValue("1")),
		)

		args := ast.ArgumentList{
			&ast.Argument{Name: "batch_size", Value: intValue("10")},
			&ast.Argument{Name: "cursor", Value: cursor},
		}

		_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal(
				"expected error: non-enum/non-string ordering must error, not silently default to ASC",
			)
		}
	})

	t.Run("unknown column in initial_value", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("nope").Return(nil)

		cursor := objectValue(
			child("initial_value", objectValue(child("nope", stringValue("v")))),
		)

		args := ast.ArgumentList{
			&ast.Argument{Name: "batch_size", Value: intValue("10")},
			&ast.Argument{Name: "cursor", Value: cursor},
		}

		_, err := arguments.ParseStream(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error")
		}
	})
}
