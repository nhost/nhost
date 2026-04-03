package tui

import (
	"errors"

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
}

type ProgressReporter interface {
	StartPhase(name string)
	EndPhase()
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

func (r *TextReporter) FailPhase(_ error) {}

func (r *TextReporter) SkipPhase(name string) {
	r.ce.Warnln("Skipped: %s", name)
}

func (r *TextReporter) Complete(_ string) {}
