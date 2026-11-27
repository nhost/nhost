package tui

import (
	"context"
	"errors"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

var errBoom = errors.New("boom")

func newTestModel(t *testing.T, state appState) (Model, context.CancelFunc) {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	m := newModel(ctx, AppConfig{}, cancel)
	m.state = state

	return m, cancel
}

func TestHandleInterruptTearsDownFromActiveStates(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		state appState
	}{
		{name: "startup", state: stateStartup},
		{name: "restarting", state: stateRestarting},
		{name: "dashboard", state: stateDashboard},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			m, cancel := newTestModel(t, tt.state)
			defer cancel()

			res, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})

			fm, ok := res.(Model)
			if !ok {
				t.Fatalf("Update returned %T, want tui.Model", res)
			}

			if fm.state != stateStopping {
				t.Errorf("state = %v, want stateStopping", fm.state)
			}

			if cmd == nil {
				t.Error("expected a teardown command, got nil")
			}
		})
	}
}

func TestHandleInterruptIgnoredWhileStopping(t *testing.T) {
	t.Parallel()

	m, cancel := newTestModel(t, stateStopping)
	defer cancel()

	res, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})

	fm, ok := res.(Model)
	if !ok {
		t.Fatalf("Update returned %T, want tui.Model", res)
	}

	if fm.state != stateStopping {
		t.Errorf("state = %v, want stateStopping", fm.state)
	}

	if cmd != nil {
		t.Error("expected no command while already stopping")
	}
}

func TestStoppedMsgWrapsError(t *testing.T) {
	t.Parallel()

	m, cancel := newTestModel(t, stateStopping)
	defer cancel()

	res, _ := m.Update(stoppedMsg{err: errBoom})

	fm, ok := res.(Model)
	if !ok {
		t.Fatalf("Update returned %T, want tui.Model", res)
	}

	if !errors.Is(fm.err, ErrStopFailed) {
		t.Errorf("err = %v, want it to wrap ErrStopFailed", fm.err)
	}

	if !errors.Is(fm.err, errBoom) {
		t.Errorf("err = %v, want it to wrap %v", fm.err, errBoom)
	}
}

func TestStoppedMsgNoErrorLeavesErrNil(t *testing.T) {
	t.Parallel()

	m, cancel := newTestModel(t, stateStopping)
	defer cancel()

	res, _ := m.Update(stoppedMsg{err: nil})

	fm, ok := res.(Model)
	if !ok {
		t.Fatalf("Update returned %T, want tui.Model", res)
	}

	if fm.err != nil {
		t.Errorf("err = %v, want nil", fm.err)
	}
}
