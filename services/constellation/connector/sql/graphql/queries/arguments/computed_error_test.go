package arguments_test

import (
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestComputedOmissionErrorRemapArgumentPath(t *testing.T) {
	t.Parallel()

	err := arguments.NewComputedOmissionError("native.selectionSet.item_second")
	err.RemapArgumentPath(func(path string) string {
		if path != "native.selectionSet.item_second" {
			t.Fatalf("unmapped path = %q", path)
		}

		return "catalog.selectionSet.items.selectionSet.item_second"
	})

	extensions, ok := err.AsMap()["extensions"].(map[string]any)
	if !ok ||
		extensions["path"] != "$.selectionSet.catalog.selectionSet.items.selectionSet.item_second.args.args" {
		t.Fatalf("remapped error = %#v", err.AsMap())
	}
}

func TestComputedOmissionError(t *testing.T) {
	t.Parallel()

	err := arguments.NewComputedOmissionError("root.selectionSet.alias")

	want := map[string]any{
		"message": "Non default arguments cannot be omitted",
		"extensions": map[string]any{
			"code": "not-supported",
			"path": "$.selectionSet.root.selectionSet.alias.args.args",
		},
	}
	if err.Error() != want["message"] || !reflect.DeepEqual(err.AsMap(), want) {
		t.Fatalf("omission error = %#v, want %#v", err.AsMap(), want)
	}
}
