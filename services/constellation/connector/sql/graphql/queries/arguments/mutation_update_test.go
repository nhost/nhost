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

var errFakeParse = errors.New("fake parse error")

func TestParseUpdate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		setupMock func(*mock.MockTable)
		args      ast.ArgumentList
		wantErr   bool
		check     func(*testing.T, arguments.Update)
	}{
		{
			name: "happy path with _set and where",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("name").
					Return(newColumn("name", "name", "text"))
				tbl.EXPECT().ParseWhere(
					gomock.Any(), gomock.Any(), "user", gomock.Any(),
					0, where.QueryAliases,
				).Return(where.Clause{}, nil)
				tbl.EXPECT().UpdatePresets("user").Return(nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "_set",
					Value: objectValue(child("name", stringValue("Alice"))),
				},
				&ast.Argument{Name: "where", Value: objectValue()},
			},
			wantErr: false,
			check: func(t *testing.T, got arguments.Update) {
				t.Helper()

				if len(got.Set) != 1 || got.Set[0].Value != "Alice" {
					t.Errorf("unexpected Set=%+v", got.Set)
				}

				if got.Where == nil {
					t.Error("expected non-nil where")
				}
			},
		},
		{
			name: "pk_columns argument builds where",
			setupMock: func(tbl *mock.MockTable) {
				pk := newColumn("id", "id", "uuid")
				tbl.EXPECT().ColumnFromGraphqlName("name").
					Return(newColumn("name", "name", "text"))
				tbl.EXPECT().PKColumns().Return([]*core.Column{pk})
				tbl.EXPECT().Dialect().Return(pgDialect())
				tbl.EXPECT().UpdatePresets("user").Return(nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "_set",
					Value: objectValue(child("name", stringValue("Alice"))),
				},
				&ast.Argument{
					Name:  "pk_columns",
					Value: objectValue(child("id", stringValue("abc"))),
				},
			},
			wantErr: false,
			check: func(t *testing.T, got arguments.Update) {
				t.Helper()

				if len(got.Where) != 1 {
					t.Errorf("expected single pk filter, got %v", got.Where)
				}

				if len(got.Set) != 1 || got.Set[0].Value != "Alice" {
					t.Errorf("unexpected Set=%+v", got.Set)
				}
			},
		},
		{
			name: "non-pk column in pk_columns errors",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().PKColumns().
					Return([]*core.Column{newColumn("id", "id", "uuid")})
				tbl.EXPECT().TableName().Return("users")
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "pk_columns",
					Value: objectValue(child("not_pk", stringValue("x"))),
				},
			},
			wantErr: true,
		},
		{
			name: "_set with unknown column errors",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("bogus").Return(nil)
				tbl.EXPECT().TableName().Return("users")
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "_set",
					Value: objectValue(child("bogus", stringValue("x"))),
				},
			},
			wantErr: true,
		},
		{
			name: "where parse error propagates",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ParseWhere(
					gomock.Any(), gomock.Any(), "user", gomock.Any(),
					0, where.QueryAliases,
				).Return(where.Clause{}, errFakeParse)
			},
			args: ast.ArgumentList{
				&ast.Argument{Name: "where", Value: objectValue()},
			},
			wantErr: true,
		},
		{
			name: "_delete_at_path with unknown column errors",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("bogus").Return(nil)
				tbl.EXPECT().TableName().Return("users")
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name: "_delete_at_path",
					Value: objectValue(
						child("bogus", listValue(child("", stringValue("a")))),
					),
				},
			},
			wantErr: true,
		},
		{
			name: "_delete_at_path arg parsed",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().ColumnFromGraphqlName("data").
					Return(newColumn("data", "data", "jsonb"))
				tbl.EXPECT().UpdatePresets("user").Return(nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name: "_delete_at_path",
					Value: objectValue(child("data", listValue(
						child("", stringValue("a")), child("", stringValue("b")),
					))),
				},
			},
			wantErr: false,
			check: func(t *testing.T, got arguments.Update) {
				t.Helper()

				if len(got.DeleteAtPath) != 1 || len(got.DeleteAtPath[0].Path) != 2 {
					t.Errorf("unexpected DeleteAtPath: %+v", got.DeleteAtPath)
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

			got, err := arguments.ParseUpdate(tbl, tt.args, nil, "user", nil)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil (got=%+v)", got)
				}

				return
			}

			if err != nil {
				t.Fatalf("ParseUpdate: %v", err)
			}

			if tt.check != nil {
				tt.check(t, got)
			}
		})
	}
}

// TestParseUpdate_UnknownArgumentSentinel ensures the default-branch
// "unexpected argument" validation failure wraps ErrInvalidArgument.
func TestParseUpdate_UnknownArgumentSentinel(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)

	args := ast.ArgumentList{
		&ast.Argument{Name: "bogus", Value: intValue("1")},
	}

	_, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
	if err == nil {
		t.Fatal("expected error: unknown argument")
	}

	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Errorf("error %v does not wrap ErrInvalidArgument", err)
	}
}

func TestParseUpdate_RejectsEmptyAndDuplicateOperators(t *testing.T) {
	t.Parallel()

	t.Run("where-only update is rejected after presets", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil)
		tbl.EXPECT().UpdatePresets("user").Return(nil)

		args := ast.ArgumentList{
			&ast.Argument{Name: "where", Value: objectValue()},
		}

		_, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: empty update")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Fatalf("error %v does not wrap ErrInvalidArgument", err)
		}

		if !strings.Contains(err.Error(), "at least one update operator") {
			t.Errorf("error %q missing empty-update context", err.Error())
		}
	})

	t.Run("same column across operators is rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		budgetCol := newColumn("budget", "budget", "numeric")
		tbl.EXPECT().ColumnFromGraphqlName("budget").Return(budgetCol).Times(2)
		tbl.EXPECT().UpdatePresets("user").Return(nil)

		args := ast.ArgumentList{
			&ast.Argument{
				Name:  "_set",
				Value: objectValue(child("budget", intValue("100"))),
			},
			&ast.Argument{
				Name:  "_inc",
				Value: objectValue(child("budget", intValue("5"))),
			},
		}

		_, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: duplicate update column")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Fatalf("error %v does not wrap ErrInvalidArgument", err)
		}

		if !strings.Contains(err.Error(), "budget") {
			t.Errorf("error %q missing duplicate column name", err.Error())
		}
	})

	t.Run("preset colliding with user update is rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		localeCol := newColumn("locale", "locale", "text")
		tbl.EXPECT().ColumnFromGraphqlName("locale").Return(localeCol)
		tbl.EXPECT().UpdatePresets("user").Return(map[string]any{"locale": "en"})
		tbl.EXPECT().ColumnFromSQLName("locale").Return(localeCol)

		args := ast.ArgumentList{
			&ast.Argument{
				Name:  "_set",
				Value: objectValue(child("locale", stringValue("fr"))),
			},
		}

		_, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: preset duplicate")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Fatalf("error %v does not wrap ErrInvalidArgument", err)
		}
	})
}

func TestParseUpdate_OperatorRouting(t *testing.T) {
	t.Parallel()

	// Each test renders an operator-specific SQL fragment in the SET clause —
	// asserting on the rendered fragment proves the parsed value landed in the
	// right slice without needing to inspect the unexported internal types.
	tests := []struct {
		name        string
		argName     string
		fieldName   string
		fieldType   string
		wantFragSQL string
	}{
		{
			name: "_inc routes to Inc", argName: "_inc", fieldName: "age", fieldType: "int",
			wantFragSQL: `"age" = "age" + $1::int`,
		},
		{
			name: "_append routes to AppendJSONB", argName: "_append", fieldName: "data", fieldType: "jsonb",
			wantFragSQL: `"data" = "data" || $1::jsonb`,
		},
		{
			name: "_prepend routes to PrependJSONB", argName: "_prepend", fieldName: "data", fieldType: "jsonb",
			wantFragSQL: `"data" = $1::jsonb || "data"`,
		},
		{
			name: "_delete_key routes to DeleteKey", argName: "_delete_key", fieldName: "data", fieldType: "jsonb",
			wantFragSQL: `"data" = "data" - $1`,
		},
		{
			name: "_delete_elem routes to DeleteElem", argName: "_delete_elem", fieldName: "data", fieldType: "jsonb",
			wantFragSQL: `"data" = "data" - $1::int`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)
			tbl.EXPECT().ColumnFromGraphqlName(tt.fieldName).
				Return(newColumn(tt.fieldName, tt.fieldName, tt.fieldType))
			tbl.EXPECT().UpdatePresets("user").Return(nil)

			args := ast.ArgumentList{
				&ast.Argument{
					Name:  tt.argName,
					Value: objectValue(child(tt.fieldName, stringValue("v"))),
				},
			}

			got, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
			if err != nil {
				t.Fatalf("ParseUpdate: %v", err)
			}

			var b strings.Builder

			got.WriteSQL(&b, nil, 1, pgDialect())

			if sql := b.String(); !strings.Contains(sql, tt.wantFragSQL) {
				t.Fatalf("expected fragment %q in %q (operator %s didn't route)",
					tt.wantFragSQL, sql, tt.argName)
			}
		})
	}
}

func TestParseUpdate_OperatorErrors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		argName string
		argVal  *ast.Value
		wantSub string
	}{
		{
			name: "_inc with non-object value", argName: "_inc",
			argVal: intValue("1"), wantSub: "_inc",
		},
		{
			name: "_append with non-object value", argName: "_append",
			argVal: intValue("1"), wantSub: "_append",
		},
		{
			name: "_prepend with non-object value", argName: "_prepend",
			argVal: intValue("1"), wantSub: "_prepend",
		},
		{
			name: "_delete_key with non-object value", argName: "_delete_key",
			argVal: intValue("1"), wantSub: "_delete_key",
		},
		{
			name: "_delete_elem with non-object value", argName: "_delete_elem",
			argVal: intValue("1"), wantSub: "_delete_elem",
		},
		{
			name: "_delete_at_path with non-object value", argName: "_delete_at_path",
			argVal: intValue("1"), wantSub: "_delete_at_path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			tbl := mock.NewMockTable(ctrl)

			args := ast.ArgumentList{
				&ast.Argument{Name: tt.argName, Value: tt.argVal},
			}

			_, err := arguments.ParseUpdate(tbl, args, nil, "user", nil)
			if err == nil {
				t.Fatalf("expected error for %s, got nil", tt.argName)
			}

			if !strings.Contains(err.Error(), tt.wantSub) {
				t.Errorf("error %q does not mention %q", err, tt.wantSub)
			}
		})
	}
}

func TestParseUpdateMany(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().ColumnFromGraphqlName("name").
			Return(newColumn("name", "name", "text")).Times(2)
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil).Times(2)
		tbl.EXPECT().UpdatePresets("user").Return(nil).Times(2)

		args := ast.ArgumentList{
			&ast.Argument{
				Name: "updates",
				Value: listValue(
					child("", objectValue(
						child("_set", objectValue(child("name", stringValue("A")))),
						child("where", objectValue()),
					)),
					child("", objectValue(
						child("_set", objectValue(child("name", stringValue("B")))),
						child("where", objectValue()),
					)),
				),
			},
		}

		got, err := arguments.ParseUpdateMany(tbl, args, nil, "user", nil)
		if err != nil {
			t.Fatalf("ParseUpdateMany: %v", err)
		}

		if len(got) != 2 {
			t.Errorf("expected 2 updates, got %d", len(got))
		}
	})

	t.Run("missing arg errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseUpdateMany(tbl, ast.ArgumentList{}, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: missing updates arg")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
		}
	})

	t.Run("empty updates list rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "updates", Value: listValue()},
		}

		_, err := arguments.ParseUpdateMany(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: empty updates array")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
		}
	})

	t.Run("non-array, non-object value rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		args := ast.ArgumentList{
			&ast.Argument{Name: "updates", Value: intValue("1")},
		}

		_, err := arguments.ParseUpdateMany(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error: must be array or object")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
		}
	})

	t.Run("variable resolution failure on updates arg", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		// variables map omits "missing" -> ResolveVariable errors.
		args := ast.ArgumentList{
			&ast.Argument{Name: "updates", Value: variableValue("missing")},
		}

		_, err := arguments.ParseUpdateMany(tbl, args, map[string]any{}, "user", nil)
		if err == nil {
			t.Fatal("expected error from unresolved updates variable")
		}

		if !strings.Contains(err.Error(), "resolve updates") {
			t.Errorf("error %q missing 'resolve updates' context", err)
		}
	})

	t.Run("per-update parse failure preserves index", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		// First update parses OK (so we reach the second). Second update
		// triggers the unknown-argument validation branch in ParseUpdate.
		tbl.EXPECT().ColumnFromGraphqlName("name").
			Return(newColumn("name", "name", "text"))
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(),
			0, where.QueryAliases,
		).Return(where.Clause{}, nil)
		tbl.EXPECT().UpdatePresets("user").Return(nil)

		args := ast.ArgumentList{
			&ast.Argument{
				Name: "updates",
				Value: listValue(
					child("", objectValue(
						child("_set", objectValue(child("name", stringValue("A")))),
						child("where", objectValue()),
					)),
					child("", objectValue(
						// "bogus" is rejected by the default branch of ParseUpdate.
						child("bogus", intValue("1")),
					)),
				),
			},
		}

		_, err := arguments.ParseUpdateMany(tbl, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected error from per-update failure")
		}

		if !strings.Contains(err.Error(), "index 1") {
			t.Errorf("error %q missing 'index 1' context", err)
		}

		// The validation sentinel propagates through ParseUpdate ->
		// ParseUpdateMany via %w.
		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
		}
	})
}

func TestApplyUpdatePresets(t *testing.T) {
	t.Parallel()

	t.Run("appends presets sorted by column name", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().UpdatePresets("user").Return(map[string]any{
			"b_col": "vb",
			"a_col": "va",
		})
		tbl.EXPECT().ColumnFromSQLName("a_col").Return(newColumn("a", "a_col", "text"))
		tbl.EXPECT().ColumnFromSQLName("b_col").Return(newColumn("b", "b_col", "text"))

		upd := arguments.Update{}
		if err := arguments.ApplyUpdatePresets(tbl, &upd, "user", nil); err != nil {
			t.Fatalf("ApplyUpdatePresets: %v", err)
		}

		if len(upd.Set) != 2 {
			t.Fatalf("got %d Set entries, want 2", len(upd.Set))
		}

		if upd.Set[0].Column.SQLName != "a_col" || upd.Set[1].Column.SQLName != "b_col" {
			t.Errorf("not sorted: %v %v",
				upd.Set[0].Column.SQLName, upd.Set[1].Column.SQLName)
		}
	})

	t.Run("no-op when role has no presets", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().UpdatePresets("user").Return(nil)

		upd := arguments.Update{}
		if err := arguments.ApplyUpdatePresets(tbl, &upd, "user", nil); err != nil {
			t.Fatalf("ApplyUpdatePresets: %v", err)
		}

		if len(upd.Set) != 0 {
			t.Errorf("expected no Set entries, got %v", upd.Set)
		}
	})

	t.Run("preset references missing column", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().UpdatePresets("user").Return(map[string]any{"x": "v"})
		tbl.EXPECT().ColumnFromSQLName("x").Return(nil)
		tbl.EXPECT().TableName().Return("users")

		upd := arguments.Update{}

		err := arguments.ApplyUpdatePresets(tbl, &upd, "user", nil)
		if err == nil {
			t.Fatal("expected error: missing column")
		}
	})
}
