package customization

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
)

func TestCloneComputedArgumentProvenance(t *testing.T) {
	t.Parallel()

	original := &graph.Schema{Inputs: []*graph.InputObjectType{
		{Name: "value_items_args", ComputedArgument: true},
		{Name: "value_items_args"},
	}}

	cloned := cloneSchema(original)
	if cloned.Inputs[0] == original.Inputs[0] || !cloned.Inputs[0].ComputedArgument ||
		cloned.Inputs[1].ComputedArgument {
		t.Fatal("clone lost computed input identity or shared the original")
	}
}
