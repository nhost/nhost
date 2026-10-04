package permissions

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

func TestFixComputedOperatorColumnsAndAliases(t *testing.T) {
	t.Parallel()

	root := &fakeTable{name: "root", columns: map[string]*core.Column{
		"root_sql": {SQLName: "root_sql", GraphqlName: "rootGQL", SQLType: "text"},
	}}
	child := &fakeTable{name: "child", columns: map[string]*core.Column{
		"child_sql": {SQLName: "child_sql", GraphqlName: "childGQL", SQLType: "text"},
	}}
	rootPath := []any{"$", "root_sql"}
	original := map[string]any{"$and": []any{
		map[string]any{"child_sql": map[string]any{"$ceq": rootPath}},
		map[string]any{"child_sql": map[string]any{"_cne": []any{"child_sql"}}},
		map[string]any{"child_sql": map[string]any{"_cast": map[string]any{
			"String": map[string]any{"$ceq": "child_sql"},
		}}},
		map[string]any{
			"$not": map[string]any{"child_sql": map[string]any{"$similar": "X-Hasura-Pattern"}},
		},
	}}

	fixed, err := fixColumnsRoot(child, root, original)
	if err != nil {
		t.Fatal(err)
	}

	want := map[string]any{"$and": []any{
		map[string]any{"childGQL": map[string]any{"$ceq": []any{"$", "rootGQL"}}},
		map[string]any{"childGQL": map[string]any{"_cne": []any{"childGQL"}}},
		map[string]any{"childGQL": map[string]any{"_cast": map[string]any{
			"String": map[string]any{"$ceq": "childGQL"},
		}}},
		map[string]any{
			"$not": map[string]any{"childGQL": map[string]any{"$similar": "x-hasura-pattern"}},
		},
	}}
	if diff := cmp.Diff(want, fixed); diff != "" {
		t.Fatalf("normalization (-want +got): %s", diff)
	}

	if diff := cmp.Diff([]any{"$", "root_sql"}, rootPath); diff != "" {
		t.Fatalf("permission metadata was mutated: %s", diff)
	}
}

func TestFixMalformedColumnReferenceDoesNotPanic(t *testing.T) {
	t.Parallel()

	child := &fakeTable{name: "child", columns: map[string]*core.Column{
		"child_sql": {SQLName: "child_sql", GraphqlName: "childGQL", SQLType: "text"},
	}}
	for _, bad := range []any{[]any{map[string]any{"bad": 1}, "child_sql"}, []any{"$", map[string]any{"bad": 1}}} {
		if _, err := fixColumns(
			child,
			map[string]any{"child_sql": map[string]any{"_ceq": bad}},
		); err != nil {
			t.Fatal(err)
		}
	}
}
