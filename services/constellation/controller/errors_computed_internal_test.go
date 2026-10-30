package controller

import (
	"fmt"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

func TestClassifyComputedOmission(t *testing.T) {
	t.Parallel()

	wrapped := fmt.Errorf(
		"building computed selection: %w",
		arguments.NewComputedOmissionError("list.selectionSet.alias"),
	)

	response, ok := classifyStructuredConnectorError(wrapped)
	if !ok || len(response) != 1 ||
		response[0]["message"] != "Non default arguments cannot be omitted" {
		t.Fatalf("computed omission was not safely classified: %#v, %t", response, ok)
	}

	extensions, valid := response[0]["extensions"].(map[string]any)
	if !valid || extensions["code"] != "not-supported" ||
		extensions["path"] != "$.selectionSet.list.selectionSet.alias.args.args" {
		t.Fatalf("computed omission code: %#v", response)
	}
}
