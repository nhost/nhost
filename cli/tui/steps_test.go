package tui_test

import (
	"testing"

	"github.com/nhost/nhost/cli/tui"
)

func TestRunStepsNoSteps(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		steps []tui.Step
	}{
		{
			name:  "nil slice",
			steps: nil,
		},
		{
			name:  "empty slice",
			steps: []tui.Step{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if err := tui.RunSteps(tt.steps); err != nil {
				t.Fatalf("RunSteps() error = %v, want nil", err)
			}
		})
	}
}
