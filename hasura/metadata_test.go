package hasura

import (
	"encoding/json"
	"testing"
)

func Test_ForeignKeyConstraintOn(t *testing.T) {
	t.Parallel()
	t.Run("unmarshal", func(t *testing.T) {
		t.Parallel()

		t.Run("only column", func(t *testing.T) {
			t.Parallel()
			var v ObjRelUsing
			err := json.Unmarshal([]byte(`{"foreign_key_constraint_on": "column1"}`), &v)
			if err != nil {
				t.Fatal(err)
			}
			if ex := "column1"; v.ForeignKeyConstraintOn.Column != ex {
				t.Fatalf("expected ForeignKeyConstraintOn.Column to be `%s', was `%s'", ex, v.ForeignKeyConstraintOn.Column)
			}
			if ex := ""; v.ForeignKeyConstraintOn.Table != ex {
				t.Fatalf("expected ForeignKeyConstraintOn.Table to be `%s', was `%s'", ex, v.ForeignKeyConstraintOn.Table)
			}
		})

		t.Run("table and column", func(t *testing.T) {
			t.Parallel()
			var v ObjRelUsing
			err := json.Unmarshal([]byte(`{"foreign_key_constraint_on": {"table": "table1", "column": "column1"}}`), &v)
			if err != nil {
				t.Fatal(err)
			}
			if ex := "column1"; v.ForeignKeyConstraintOn.Column != ex {
				t.Fatalf("expected ForeignKeyConstraintOn.Column to be `%s', was `%s'", ex, v.ForeignKeyConstraintOn.Column)
			}
			if ex := "table1"; v.ForeignKeyConstraintOn.Table != ex {
				t.Fatalf("expected ForeignKeyConstraintOn.Table to be `%s', was `%s'", ex, v.ForeignKeyConstraintOn.Table)
			}
		})
	})

	t.Run("marshal", func(t *testing.T) {
		t.Parallel()

		t.Run("only column", func(t *testing.T) {
			t.Parallel()
			v := ObjRelUsing{
				ForeignKeyConstraintOn: &ForeignKeyConstraintOn{
					Table:  "",
					Column: "column1",
				},
				ManualConfiguration: nil,
			}
			data, err := json.Marshal(v)
			if err != nil {
				t.Fatal(err)
			}
			if ex := `{"foreign_key_constraint_on":"column1"}`; string(data) != ex {
				t.Fatalf("expected `%s', was `%s'", ex, string(data))
			}
		})

		t.Run("table and column", func(t *testing.T) {
			t.Parallel()
			v := ObjRelUsing{
				ForeignKeyConstraintOn: &ForeignKeyConstraintOn{
					Table:  "table1",
					Column: "column1",
				},
				ManualConfiguration: nil,
			}
			data, err := json.Marshal(v)
			if err != nil {
				t.Fatal(err)
			}
			if ex := `{"foreign_key_constraint_on":{"table":"table1","column":"column1"}}`; string(data) != ex {
				t.Fatalf("expected `%s', was `%s'", ex, string(data))
			}
		})
	})
}
