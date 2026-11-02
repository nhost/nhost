package postgres

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata"
)

var errComputedCatalogUnavailable = errors.New("catalog unavailable")

func TestComputedCatalogFailure(t *testing.T) {
	t.Parallel()

	q := &stubQuerier{queryRows: func(_ context.Context, _ string, args ...any) (Rows, error) {
		if len(args) != 4 || args[0] != "cf_select" || args[1] != "item_label" ||
			args[2] != "cf_select" || args[3] != "items" {
			t.Errorf("unexpected catalog parameters: %v", args)
		}

		return nil, errComputedCatalogUnavailable
	}}
	field := metadata.ComputedField{
		Name: "label",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_label"},
		},
	}

	_, err := lookupComputedFunction(
		t.Context(),
		q,
		metadata.TableSource{Schema: "cf_select", Name: "items"},
		field,
	)
	if !errors.Is(err, errComputedCatalogUnavailable) ||
		!strings.Contains(err.Error(), "cf_select.item_label") {
		t.Fatalf("catalog error = %v, want wrapped connection failure", err)
	}

	field.DecodeError = "invalid wire definition"

	got, err := lookupComputedFunction(
		t.Context(),
		q,
		metadata.TableSource{Schema: "cf_select", Name: "items"},
		field,
	)
	if err != nil || got.Function != nil || got.Reason != field.DecodeError {
		t.Fatalf("invalid wire lookup = %+v, %v", got, err)
	}
}
