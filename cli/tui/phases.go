package tui

import (
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
)

var ErrInterrupted = errors.New("interrupted")

type PhaseStatus int

const (
	StatusPending PhaseStatus = iota
	StatusRunning
	StatusDone
	StatusFailed
	StatusSkipped
)

type Phase struct {
	Name   string
	Status PhaseStatus
	Err    error
	Detail string
}

type ProgressReporter interface {
	StartPhase(name string)
	EndPhase()
	EndPhaseWithDetail(detail string)
	FailPhase(err error)
	SkipPhase(name string)
	Complete(info string)
}

type TextReporter struct {
	ce *clienv.CliEnv
}

func NewTextReporter(ce *clienv.CliEnv) *TextReporter {
	return &TextReporter{ce: ce}
}

func (r *TextReporter) StartPhase(name string) {
	r.ce.Infoln("%s...", name)
}

func (r *TextReporter) EndPhase() {}

func (r *TextReporter) EndPhaseWithDetail(_ string) {}

func (r *TextReporter) FailPhase(_ error) {}

func (r *TextReporter) SkipPhase(name string) {
	r.ce.Warnln("Skipped: %s", name)
}

func (r *TextReporter) Complete(info string) {
	if info == "" {
		return
	}

	if _, err := fmt.Fprint(r.ce.Stdout(), info); err != nil {
		panic(err)
	}
}

// PrintCheck prints a single line with a green checkmark.
func PrintCheck(msg string) {
	fmt.Println("  " + phaseCheck + " " + msg) //nolint:forbidigo
}
