package arguments_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestComputedJSONPathError(t *testing.T) {
	t.Parallel()

	path := `a:b`
	err := arguments.NewComputedJSONPathError(path)
	err.StampArgumentPath("cf_select_items.selectionSet.item_payload")

	message := `parse json path error: a:b. Accept letters, digits, underscore (_) or hyphen (-) only. Use quotes enclosed in bracket (["..."]) if there is any special character`

	want := map[string]any{
		"message": message,
		"extensions": map[string]any{
			"code": "validation-failed",
			"path": "$.selectionSet.cf_select_items.selectionSet.item_payload.args",
		},
	}
	if !errors.Is(err, arguments.ErrInvalidArgument) || !reflect.DeepEqual(err.AsMap(), want) {
		t.Fatalf("path error = %#v, want %#v", err.AsMap(), want)
	}
}
