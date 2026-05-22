package arguments_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"go.uber.org/mock/gomock"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments/mock"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// errStatement is a where.Statement that always returns the configured error.
// Used to drive the error branches in OnConflict.ToSQL where Where.WriteCondition
// fails.
type errStatement struct{ err error }

func (e *errStatement) WriteCondition(
	_ *strings.Builder, _ string, _ []any, _ int,
) ([]any, int, error) {
	return nil, 0, e.err
}

func TestOnConflict_ToSQL(t *testing.T) {
	t.Parallel()

	t.Run("nil on conflict is a no-op", func(t *testing.T) {
		t.Parallel()

		var (
			b      strings.Builder
			oc     *arguments.OnConflict
			params []any
		)

		gotParams, gotIdx, err := oc.ToSQL(&b, params, 1)
		if err != nil {
			t.Fatalf("ToSQL: %v", err)
		}

		if b.Len() != 0 || gotIdx != 1 || gotParams != nil {
			t.Errorf("expected no-op, got sql=%q idx=%d params=%v", b.String(), gotIdx, gotParams)
		}
	})

	t.Run("DO NOTHING when no update columns", func(t *testing.T) {
		t.Parallel()

		oc := &arguments.OnConflict{
			ConstraintName: "users_pkey",
			UpdateColumns:  nil,
			Where:          nil,
		}

		var b strings.Builder
		if _, _, err := oc.ToSQL(&b, nil, 1); err != nil {
			t.Fatalf("ToSQL: %v", err)
		}

		want := ` ON CONFLICT ON CONSTRAINT "users_pkey" DO NOTHING`
		if b.String() != want {
			t.Errorf("got=%q want=%q", b.String(), want)
		}
	})

	t.Run("DO UPDATE SET column list", func(t *testing.T) {
		t.Parallel()

		oc := &arguments.OnConflict{
			ConstraintName: "users_pkey",
			UpdateColumns:  []string{"email", "name"},
			Where:          nil,
		}

		var b strings.Builder
		if _, _, err := oc.ToSQL(&b, nil, 1); err != nil {
			t.Fatalf("ToSQL: %v", err)
		}

		want := ` ON CONFLICT ON CONSTRAINT "users_pkey" DO UPDATE SET ` +
			`"email" = EXCLUDED."email", "name" = EXCLUDED."name"`
		if b.String() != want {
			t.Errorf("got=%q want=%q", b.String(), want)
		}
	})

	t.Run("with WHERE clause", func(t *testing.T) {
		t.Parallel()

		// Build a one-statement clause: is_active = $1::bool
		col := newColumn("is_active", "is_active", "bool")
		f := where.NewEqualsFilter(col, true, pgDialect())

		oc := &arguments.OnConflict{
			ConstraintName: "users_pkey",
			UpdateColumns:  []string{"email"},
			Where:          where.Clause{f},
		}

		var b strings.Builder

		params, idx, err := oc.ToSQL(&b, nil, 1)
		if err != nil {
			t.Fatalf("ToSQL: %v", err)
		}

		if !strings.Contains(b.String(), `EXCLUDED."is_active" = $1::bool`) {
			t.Errorf("missing WHERE fragment: %q", b.String())
		}

		if len(params) != 1 || params[0] != true {
			t.Errorf("params=%v", params)
		}

		if idx != 2 {
			t.Errorf("paramIndex=%d want=2", idx)
		}
	})
}

// TestOnConflict_ToSQL_WhereWriteConditionError covers the failure branch
// where the Where clause's WriteCondition returns an error and ToSQL must
// wrap it with call-site context.
func TestOnConflict_ToSQL_WhereWriteConditionError(t *testing.T) {
	t.Parallel()

	sentinel := errors.New("boom") //nolint:err113 // test sentinel
	oc := &arguments.OnConflict{
		ConstraintName: "users_pkey",
		UpdateColumns:  []string{"email"},
		Where:          where.Clause{&errStatement{err: sentinel}},
	}

	var b strings.Builder

	_, _, err := oc.ToSQL(&b, nil, 1)
	if err == nil {
		t.Fatal("expected error from Where.WriteCondition failure")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("error %v does not wrap sentinel %v", err, sentinel)
	}

	if !strings.Contains(err.Error(), "on_conflict where clause") {
		t.Errorf("error %q missing 'on_conflict where clause' context", err.Error())
	}
}

func TestParseOnConflict(t *testing.T) {
	t.Parallel()

	t.Run("nil arg returns nil OnConflict", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		got, err := arguments.ParseOnConflict(tbl, nil, nil, "user", nil)
		if err != nil {
			t.Fatalf("ParseOnConflict: %v", err)
		}

		if got != nil {
			t.Errorf("expected nil OnConflict, got %+v", got)
		}
	})

	t.Run("happy path with constraint + columns + where", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().ColumnFromGraphqlName("email").Return(newColumn("email", "email_sql", "text"))
		tbl.EXPECT().ParseWhere(
			gomock.Any(), gomock.Any(), "user", gomock.Any(), 0, where.QueryAliases,
		).Return(where.Clause{}, nil)

		input := objectValue(
			child("constraint", enumValue("users_pkey")),
			child("update_columns", listValue(child("", enumValue("email")))),
			child("where", objectValue()),
		)

		got, err := arguments.ParseOnConflict(
			tbl,
			&ast.Argument{Name: "on_conflict", Value: input},
			nil, "user", nil,
		)
		if err != nil {
			t.Fatalf("ParseOnConflict: %v", err)
		}

		if got.ConstraintName != "users_pkey" {
			t.Errorf("constraint=%q want=users_pkey", got.ConstraintName)
		}

		if len(got.UpdateColumns) != 1 || got.UpdateColumns[0] != "email_sql" {
			t.Errorf("update columns=%v", got.UpdateColumns)
		}

		if got.Where == nil {
			t.Error("expected non-nil where")
		}
	})

	t.Run("missing constraint errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseOnConflict(
			tbl,
			&ast.Argument{
				Name:  "on_conflict",
				Value: objectValue(child("update_columns", listValue())),
			},
			nil, "user", nil,
		)
		if err == nil {
			t.Fatal("expected error: constraint is required")
		}
	})

	t.Run("non-enum constraint errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseOnConflict(
			tbl,
			&ast.Argument{
				Name:  "on_conflict",
				Value: objectValue(child("constraint", stringValue("users_pkey"))),
			},
			nil, "user", nil,
		)
		if err == nil {
			t.Fatal("expected error: constraint must be enum")
		}
	})

	t.Run("unknown update column errors", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().ColumnFromGraphqlName("bogus").Return(nil)
		tbl.EXPECT().TableName().Return("users")

		_, err := arguments.ParseOnConflict(
			tbl,
			&ast.Argument{
				Name: "on_conflict",
				Value: objectValue(
					child("constraint", enumValue("users_pkey")),
					child("update_columns", listValue(child("", enumValue("bogus")))),
				),
			},
			nil, "user", nil,
		)
		if err == nil {
			t.Fatal("expected error for unknown column")
		}
	})

	t.Run("non-object value rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		_, err := arguments.ParseOnConflict(
			tbl,
			&ast.Argument{Name: "on_conflict", Value: intValue("1")},
			nil, "user", nil,
		)
		if err == nil {
			t.Fatal("expected error: must be object")
		}

		if !errors.Is(err, arguments.ErrInvalidArgument) {
			t.Errorf("error %v does not wrap ErrInvalidArgument", err)
		}
	})
}

// TestParseOnConflict_WhereParseError covers the branch where the inner
// ParseWhere call fails — exercising the wrap at mutation_insert.go where
// "failed to parse on_conflict.where" is added as context.
func TestParseOnConflict_WhereParseError(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)

	sentinel := errors.New("where parse failed") //nolint:err113 // test sentinel
	tbl.EXPECT().ParseWhere(
		gomock.Any(), gomock.Any(), "user", gomock.Any(), 0, where.QueryAliases,
	).Return(nil, sentinel)

	_, err := arguments.ParseOnConflict(
		tbl,
		&ast.Argument{
			Name: "on_conflict",
			Value: objectValue(
				child("constraint", enumValue("users_pkey")),
				child("where", objectValue()),
			),
		},
		nil, "user", nil,
	)
	if err == nil {
		t.Fatal("expected error from ParseWhere failure")
	}

	if !errors.Is(err, sentinel) {
		t.Errorf("error %v does not wrap sentinel %v", err, sentinel)
	}

	if !strings.Contains(err.Error(), "on_conflict.where") {
		t.Errorf("error %q missing 'on_conflict.where' context", err.Error())
	}
}

// TestParseOnConflict_MissingConstraintSentinel ensures the
// "constraint is required" validation failure wraps ErrInvalidArgument so
// callers can distinguish a 4xx bad-request from a 5xx server-side failure.
func TestParseOnConflict_MissingConstraintSentinel(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	tbl := mock.NewMockTable(ctrl)

	_, err := arguments.ParseOnConflict(
		tbl,
		&ast.Argument{
			Name:  "on_conflict",
			Value: objectValue(child("update_columns", listValue())),
		},
		nil, "user", nil,
	)
	if err == nil {
		t.Fatal("expected error")
	}

	if !errors.Is(err, arguments.ErrInvalidArgument) {
		t.Errorf("error %v does not wrap ErrInvalidArgument", err)
	}
}

func TestParseInsert(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		setupMock      func(*mock.MockTable)
		args           ast.ArgumentList
		wantErr        bool
		wantInvalidArg bool
		check          func(*testing.T, arguments.InsertObject, *arguments.OnConflict)
	}{
		{
			name: "happy path with object only",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().Relationship("name").Return(nil)
				tbl.EXPECT().ColumnFromGraphqlName("name").
					Return(newColumn("name", "name", "text"))
				tbl.EXPECT().InsertPresets("user").Return(nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "object",
					Value: objectValue(child("name", stringValue("Alice"))),
				},
			},
			wantErr: false,
			check: func(t *testing.T, obj arguments.InsertObject, oc *arguments.OnConflict) {
				t.Helper()

				if oc != nil {
					t.Errorf("expected nil OnConflict, got %+v", oc)
				}

				if len(obj.Columns) != 1 || obj.Columns[0].Column.SQLName != "name" ||
					obj.Columns[0].Value != "Alice" {
					t.Errorf("unexpected columns: %+v", obj.Columns)
				}
			},
		},
		{
			name:           "missing object errors",
			setupMock:      func(_ *mock.MockTable) {},
			args:           ast.ArgumentList{},
			wantErr:        true,
			wantInvalidArg: true,
		},
		{
			name:      "non-object object arg errors",
			setupMock: func(_ *mock.MockTable) {},
			args: ast.ArgumentList{
				&ast.Argument{Name: "object", Value: intValue("1")},
			},
			wantErr: true,
		},
		{
			name: "unknown column errors",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().Relationship("nope").Return(nil)
				tbl.EXPECT().ColumnFromGraphqlName("nope").Return(nil)
				tbl.EXPECT().TableName().Return("users")
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "object",
					Value: objectValue(child("nope", stringValue("x"))),
				},
			},
			wantErr: true,
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

			obj, oc, err := arguments.ParseInsert(tbl, tt.args, nil, "user", nil)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}

				if tt.wantInvalidArg && !errors.Is(err, arguments.ErrInvalidArgument) {
					t.Errorf("error %v does not wrap ErrInvalidArgument", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("ParseInsert: %v", err)
			}

			if tt.check != nil {
				tt.check(t, obj, oc)
			}
		})
	}
}

func TestParseInsertCollection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		setupMock      func(*mock.MockTable)
		args           ast.ArgumentList
		wantErr        bool
		wantInvalidArg bool
		wantCount      int
	}{
		{
			name: "happy path - list of objects",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().Relationship("name").Return(nil).Times(2)
				tbl.EXPECT().
					ColumnFromGraphqlName("name").
					Return(newColumn("name", "name", "text")).
					Times(2)
				tbl.EXPECT().InsertPresets("user").Return(nil).Times(2)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name: "objects",
					Value: listValue(
						child("", objectValue(child("name", stringValue("Alice")))),
						child("", objectValue(child("name", stringValue("Bob")))),
					),
				},
			},
			wantErr:   false,
			wantCount: 2,
		},
		{
			name: "single-object coerced to list",
			setupMock: func(tbl *mock.MockTable) {
				tbl.EXPECT().Relationship("name").Return(nil)
				tbl.EXPECT().ColumnFromGraphqlName("name").
					Return(newColumn("name", "name", "text"))
				tbl.EXPECT().InsertPresets("user").Return(nil)
			},
			args: ast.ArgumentList{
				&ast.Argument{
					Name:  "objects",
					Value: objectValue(child("name", stringValue("Alice"))),
				},
			},
			wantErr:   false,
			wantCount: 1,
		},
		{
			name:      "empty list errors",
			setupMock: func(_ *mock.MockTable) {},
			args: ast.ArgumentList{
				&ast.Argument{Name: "objects", Value: listValue()},
			},
			wantErr:        true,
			wantInvalidArg: true,
		},
		{
			name:           "missing arg errors",
			setupMock:      func(_ *mock.MockTable) {},
			args:           ast.ArgumentList{},
			wantErr:        true,
			wantInvalidArg: true,
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

			objs, _, err := arguments.ParseInsertCollection(tbl, tt.args, nil, "user", nil)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}

				if tt.wantInvalidArg && !errors.Is(err, arguments.ErrInvalidArgument) {
					t.Errorf("error %v does not wrap ErrInvalidArgument", err)
				}

				return
			}

			if err != nil {
				t.Fatalf("ParseInsertCollection: %v", err)
			}

			if len(objs) != tt.wantCount {
				t.Errorf("expected %d objects, got %d", tt.wantCount, len(objs))
			}
		})
	}
}

func TestApplyInsertPresets(t *testing.T) {
	t.Parallel()

	t.Run("appends presets sorted by column name", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)

		tbl.EXPECT().InsertPresets("user").Return(map[string]any{
			"b_col": "vb",
			"a_col": "va",
		})
		tbl.EXPECT().ColumnFromSQLName("a_col").Return(newColumn("a", "a_col", "text"))
		tbl.EXPECT().ColumnFromSQLName("b_col").Return(newColumn("b", "b_col", "text"))

		insertObj := arguments.InsertObject{Columns: nil, NestedInserts: nil}
		if err := arguments.ApplyInsertPresets(tbl, &insertObj, "user", nil); err != nil {
			t.Fatalf("ApplyInsertPresets: %v", err)
		}

		if len(insertObj.Columns) != 2 {
			t.Fatalf("got %d columns, want 2", len(insertObj.Columns))
		}

		if insertObj.Columns[0].Column.SQLName != "a_col" ||
			insertObj.Columns[1].Column.SQLName != "b_col" {
			t.Errorf("not sorted: %v %v",
				insertObj.Columns[0].Column.SQLName, insertObj.Columns[1].Column.SQLName)
		}
	})

	t.Run("no-op when role has no presets", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().InsertPresets("user").Return(nil)

		insertObj := arguments.InsertObject{Columns: nil, NestedInserts: nil}
		if err := arguments.ApplyInsertPresets(tbl, &insertObj, "user", nil); err != nil {
			t.Fatalf("ApplyInsertPresets: %v", err)
		}

		if len(insertObj.Columns) != 0 {
			t.Errorf("expected no columns, got %v", insertObj.Columns)
		}
	})

	t.Run("preset references missing column", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		tbl := mock.NewMockTable(ctrl)
		tbl.EXPECT().InsertPresets("user").Return(map[string]any{"x": "v"})
		tbl.EXPECT().ColumnFromSQLName("x").Return(nil)
		tbl.EXPECT().TableName().Return("users")

		insertObj := arguments.InsertObject{Columns: nil, NestedInserts: nil}

		err := arguments.ApplyInsertPresets(tbl, &insertObj, "user", nil)
		if err == nil {
			t.Fatal("expected error: missing column")
		}
	})
}

func TestInsertObject_ColumnNames(t *testing.T) {
	t.Parallel()

	obj := arguments.InsertObject{
		Columns: []arguments.InsertColumn{
			{Column: newColumn("a", "a_sql", "text"), Value: 1},
			{Column: newColumn("b", "b_sql", "int"), Value: 2},
		},
		NestedInserts: nil,
	}

	got := obj.ColumnNames()
	if len(got) != 2 || got[0] != "a_sql" || got[1] != "b_sql" {
		t.Errorf("got=%v want=[a_sql b_sql]", got)
	}
}

func TestNestedInsert_ApplyArrayFKColumn(t *testing.T) {
	t.Parallel()

	t.Run("object relationship: no-op", func(t *testing.T) {
		t.Parallel()

		n := arguments.NestedInsert{
			RelationshipName:    "author",
			TargetTable:         nil,
			NestedObject:        arguments.InsertObject{Columns: nil, NestedInserts: nil},
			OnConflict:          nil,
			ForeignKeyColumn:    "fk",
			IsArrayRelationship: false,
		}

		fk := n.ApplyArrayFKColumn("parent_cte")
		if len(fk) != 0 {
			t.Errorf("object rel must produce empty map, got %v", fk)
		}
	})

	t.Run("array relationship: appends FK column", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		target := mock.NewMockTable(ctrl)

		fkCol := newColumn("fk", "fk", "uuid")
		target.EXPECT().ColumnFromSQLName("fk").Return(fkCol)

		n := arguments.NestedInsert{
			RelationshipName:    "posts",
			TargetTable:         target,
			NestedObject:        arguments.InsertObject{Columns: nil, NestedInserts: nil},
			OnConflict:          nil,
			ForeignKeyColumn:    "fk",
			IsArrayRelationship: true,
		}

		fk := n.ApplyArrayFKColumn("parent_cte")
		if got, ok := fk["fk"]; !ok || got != "parent_cte" {
			t.Errorf("fk map = %v, want fk=parent_cte", fk)
		}

		if len(n.NestedObject.Columns) != 1 || n.NestedObject.Columns[0].Column != fkCol {
			t.Errorf("expected fk column appended; got %+v", n.NestedObject.Columns)
		}
	})

	t.Run("array relationship: missing FK column is silently skipped", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		target := mock.NewMockTable(ctrl)
		target.EXPECT().ColumnFromSQLName("fk").Return(nil)

		n := arguments.NestedInsert{
			RelationshipName:    "posts",
			TargetTable:         target,
			NestedObject:        arguments.InsertObject{Columns: nil, NestedInserts: nil},
			OnConflict:          nil,
			ForeignKeyColumn:    "fk",
			IsArrayRelationship: true,
		}

		fk := n.ApplyArrayFKColumn("parent_cte")
		if len(n.NestedObject.Columns) != 0 {
			t.Errorf("expected no column appended; got %+v", n.NestedObject.Columns)
		}

		// FK index entry is still added, regardless of column resolution.
		if fk["fk"] != "parent_cte" {
			t.Errorf("fk map = %v, expected fk=parent_cte entry", fk)
		}
	})
}

func TestParseInsert_NestedRelationship(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	parent := mock.NewMockTable(ctrl)
	target := mock.NewMockTable(ctrl)
	rel := mock.NewMockRelationship(ctrl)

	// Parent table sees "posts" as a relationship rather than a column.
	parent.EXPECT().Relationship("posts").Return(rel)
	parent.EXPECT().InsertPresets("user").Return(nil)

	// Relationship metadata used to construct NestedInsert.
	rel.EXPECT().TargetTable().Return(target)
	rel.EXPECT().FKColumn().Return("author_id")
	rel.EXPECT().IsArray().Return(true)

	// Target table parses its own object as a normal insert.
	target.EXPECT().Relationship("title").Return(nil)
	target.EXPECT().ColumnFromGraphqlName("title").Return(newColumn("title", "title", "text"))
	target.EXPECT().InsertPresets("user").Return(nil)

	args := ast.ArgumentList{
		&ast.Argument{
			Name: "object",
			Value: objectValue(child("posts", objectValue(
				child("data", objectValue(child("title", stringValue("Hi")))),
			))),
		},
	}

	obj, _, err := arguments.ParseInsert(parent, args, nil, "user", nil)
	if err != nil {
		t.Fatalf("ParseInsert: %v", err)
	}

	if len(obj.NestedInserts) != 1 {
		t.Fatalf("got %d nested inserts, want 1", len(obj.NestedInserts))
	}

	if got := obj.NestedInserts[0]; got.RelationshipName != "posts" ||
		got.ForeignKeyColumn != "author_id" || !got.IsArrayRelationship {
		t.Errorf("unexpected nested insert: %+v", got)
	}
}

func TestParseInsert_NestedRelationshipFailures(t *testing.T) {
	t.Parallel()

	t.Run("nested value must be an object", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		parent := mock.NewMockTable(ctrl)
		rel := mock.NewMockRelationship(ctrl)
		parent.EXPECT().Relationship("posts").Return(rel)

		args := ast.ArgumentList{
			&ast.Argument{
				Name:  "object",
				Value: objectValue(child("posts", intValue("1"))),
			},
		}

		_, _, err := arguments.ParseInsert(parent, args, nil, "user", nil)
		if err == nil || !strings.Contains(err.Error(), "must be an object") {
			t.Fatalf("expected 'must be an object' error, got: %v", err)
		}
	})

	t.Run("missing data field rejected", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		parent := mock.NewMockTable(ctrl)
		rel := mock.NewMockRelationship(ctrl)
		parent.EXPECT().Relationship("posts").Return(rel)

		args := ast.ArgumentList{
			&ast.Argument{
				Name: "object",
				Value: objectValue(child("posts", objectValue(
					child("on_conflict", objectValue()),
				))),
			},
		}

		_, _, err := arguments.ParseInsert(parent, args, nil, "user", nil)
		if err == nil || !strings.Contains(err.Error(), "missing data field") {
			t.Fatalf("expected missing-data error, got: %v", err)
		}
	})

	t.Run("target table parse error propagates", func(t *testing.T) {
		t.Parallel()

		ctrl := gomock.NewController(t)
		parent := mock.NewMockTable(ctrl)
		target := mock.NewMockTable(ctrl)
		rel := mock.NewMockRelationship(ctrl)

		parent.EXPECT().Relationship("posts").Return(rel)
		rel.EXPECT().TargetTable().Return(target)
		target.EXPECT().Relationship("bogus").Return(nil)
		target.EXPECT().ColumnFromGraphqlName("bogus").Return(nil)
		target.EXPECT().TableName().Return("posts")

		args := ast.ArgumentList{
			&ast.Argument{
				Name: "object",
				Value: objectValue(child("posts", objectValue(
					child("data", objectValue(child("bogus", stringValue("x")))),
				))),
			},
		}

		_, _, err := arguments.ParseInsert(parent, args, nil, "user", nil)
		if err == nil {
			t.Fatal("expected target-table parse failure")
		}

		if !strings.Contains(err.Error(), "posts") {
			t.Errorf("error %q missing relationship name context", err)
		}
	})
}
