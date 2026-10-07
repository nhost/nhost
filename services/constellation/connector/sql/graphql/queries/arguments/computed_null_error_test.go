package arguments_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestNewComputedScalarInputError(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		typeName, name string
	}{
		{"p14_posint", "n"},
		{"p14_pair", "p"},
		{"_int4", "ids"},
	} {
		t.Run(tt.typeName, func(t *testing.T) {
			t.Parallel()

			err := arguments.NewComputedScalarInputError(
				tt.typeName, tt.name, "cf_select_items.selectionSet.p14_field",
			)

			want := map[string]any{
				"message": "A string is expected for type: " + tt.typeName,
				"extensions": map[string]any{
					"code": "parse-failed",
					"path": "$.selectionSet.cf_select_items.selectionSet.p14_field.args.args." + tt.name,
				},
			}
			if !errors.Is(err, arguments.ErrInvalidArgument) ||
				!reflect.DeepEqual(err.AsMap(), want) {
				t.Fatalf("custom scalar error = %+v, want %+v", err.AsMap(), want)
			}
		})
	}
}

func TestNewComputedNullArgumentError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, argument, typeName, message, path string
	}{
		{
			name:     "args",
			argument: "args",
			typeName: "item_score_cf_select_items_args",
			message:  "expected an object for type 'item_score_cf_select_items_args', but found null",
			path:     "$.selectionSet.cf_select_items.selectionSet.item_score.args.args",
		},
		{
			name: "path", argument: "path", typeName: "String",
			message: "expected a string for type 'String', but found null",
			path:    "$.selectionSet.cf_select_items.selectionSet.item_score.args.path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := arguments.NewComputedNullArgumentError(tt.argument, tt.typeName)
			err.StampArgumentPath("cf_select_items.selectionSet.item_score")

			want := map[string]any{
				"message": tt.message,
				"extensions": map[string]any{
					"code": "validation-failed", "path": tt.path,
				},
			}
			if !errors.Is(err, arguments.ErrInvalidArgument) ||
				err.Error() != tt.message || !reflect.DeepEqual(err.AsMap(), want) {
				t.Fatalf("null error = %#v (%v), want %#v", err.AsMap(), err, want)
			}
		})
	}
}
