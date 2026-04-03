package spinner_test

import (
	"testing"

	"github.com/charmbracelet/bubbles/spinner"
)

func TestSpinnerNew(t *testing.T) {
	assertEqualSpinner := func(t *testing.T, exp, got spinner.Spinner) {
		t.Helper()

		if exp.FPS != got.FPS {
			t.Errorf("expecting %d FPS, got %d", exp.FPS, got.FPS)
		}

		if e, g := len(exp.Frames), len(got.Frames); e != g {
			t.Fatalf("expecting %d frames, got %d", e, g)
		}

		for i, e := range exp.Frames {
			if g := got.Frames[i]; e != g {
				t.Errorf("expecting frame index %d with value %q, got %q", i, e, g)
			}
		}
	}
	t.Run("default", func(t *testing.T) {
		s := spinner.New()

		assertEqualSpinner(t, spinner.Line, s.Spinner)
	})

	t.Run("WithSpinner", func(t *testing.T) {
		customSpinner := spinner.Spinner{
			Frames: []string{"a", "b", "c", "d"},
			FPS:    16,
		}

		s := spinner.New(spinner.WithSpinner(customSpinner))

		assertEqualSpinner(t, customSpinner, s.Spinner)
	})

	tests := map[string]spinner.Spinner{
		"Line":    spinner.Line,
		"Dot":     spinner.Dot,
		"MiniDot": spinner.MiniDot,
		"Jump":    spinner.Jump,
		"Pulse":   spinner.Pulse,
		"Points":  spinner.Points,
		"Globe":   spinner.Globe,
		"Moon":    spinner.Moon,
		"Monkey":  spinner.Monkey,
	}

	for name, s := range tests {
		t.Run(name, func(t *testing.T) {
			assertEqualSpinner(t, spinner.New(spinner.WithSpinner(s)).Spinner, s)
		})
	}
}
