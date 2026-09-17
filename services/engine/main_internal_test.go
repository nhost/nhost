package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

const (
	signalTestHelperEnv       = "NHOST_ENGINE_SIGNAL_TEST_HELPER"
	signalTestOrdinary        = "ordinary"
	signalTestWedged          = "wedged"
	signalTestTierTimeout     = 50 * time.Millisecond
	signalTestDrainDuration   = 3 * time.Second
	signalTestSecondSignalGap = 100 * time.Millisecond
	signalTestProcessTimeout  = 5 * time.Second
)

var (
	errSignalHelperTimeout = errors.New("timed out waiting for signal helper")
	errSignalHelperMode    = errors.New("unknown signal helper mode")
	errSignalWedgeResult   = errors.New("wedge did not produce the expected tier timeout")
)

func TestSignalContextShutdownScenarios(t *testing.T) {
	t.Parallel()

	if mode := os.Getenv(signalTestHelperEnv); mode != "" {
		if err := runSignalTestHelper(mode); err != nil {
			t.Fatal(err)
		}

		return
	}

	tests := []struct {
		name         string
		mode         string
		secondSignal bool
		wantFinal    string
	}{
		{
			name:      "single SIGTERM lets ordinary drain complete",
			mode:      signalTestOrdinary,
			wantFinal: "DRAINED",
		},
		{
			name:         "fast double SIGTERM lets ordinary drain complete",
			mode:         signalTestOrdinary,
			secondSignal: true,
			wantFinal:    "DRAINED",
		},
		{
			name:      "wedged service escapes through tier bound",
			mode:      signalTestWedged,
			wantFinal: "WEDGE_ESCAPED",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			runSignalScenario(t, tc.mode, tc.secondSignal, tc.wantFinal)
		})
	}
}

func runSignalScenario(t *testing.T, mode string, secondSignal bool, wantFinal string) {
	t.Helper()

	executable, err := os.Executable()
	if err != nil {
		t.Fatalf("locating test executable: %v", err)
	}

	cmd := exec.Command(executable, "-test.run=^TestSignalContextShutdownScenarios$")

	cmd.Env = append(os.Environ(), signalTestHelperEnv+"="+mode)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatalf("creating helper stdout pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		t.Fatalf("starting signal helper: %v", err)
	}
	defer func() {
		if cmd.ProcessState == nil {
			if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
				t.Errorf("killing signal helper: %v", err)
			}

			if err := cmd.Wait(); err != nil {
				t.Logf("signal helper cleanup wait: %v", err)
			}
		}
	}()

	lines := make(chan string)
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			lines <- scanner.Text()
		}

		close(lines)
	}()

	waitForHelperLine(t, lines, "READY")

	firstSignalAt := time.Now()

	if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatalf("sending first SIGTERM: %v", err)
	}

	waitForHelperLine(t, lines, "CANCELLED")

	if secondSignal {
		if remaining := signalTestSecondSignalGap - time.Since(firstSignalAt); remaining > 0 {
			time.Sleep(remaining)
		}

		if err := cmd.Process.Signal(syscall.SIGTERM); err != nil {
			t.Fatalf("sending fast second SIGTERM: %v", err)
		}
	}

	waitForHelperLine(t, lines, wantFinal)

	if err := waitForSignalHelper(cmd); err != nil {
		t.Fatalf("signal helper did not exit cleanly: %v", err)
	}

	t.Logf(
		"mode=%s second_SIGTERM=%t result=%s exit=0",
		mode, secondSignal, wantFinal,
	)
}

func waitForSignalHelper(cmd *exec.Cmd) error {
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		return err
	case <-time.After(signalTestProcessTimeout):
		if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
			return fmt.Errorf("killing timed-out signal helper: %w", err)
		}

		<-done

		return errSignalHelperTimeout
	}
}

func runSignalTestHelper(mode string) error {
	ctx, stop := signalContext()
	defer stop()

	switch mode {
	case signalTestOrdinary:
		writeSignalTestHelperLine("READY\n")
		<-ctx.Done()
		writeSignalTestHelperLine("CANCELLED\n")
		time.Sleep(signalTestDrainDuration)
		writeSignalTestHelperLine("DRAINED\n")
	case signalTestWedged:
		return runWedgedSignalTestHelper(ctx)
	default:
		return errSignalHelperMode
	}

	return nil
}

func runWedgedSignalTestHelper(ctx context.Context) error {
	stuckStarted := make(chan struct{})
	done := make(chan error, 1)

	stuck := func(context.Context) error {
		close(stuckStarted)

		select {}
	}
	laterTier := func(ctx context.Context) error {
		<-ctx.Done()

		return nil
	}

	go func() {
		done <- serveutil.Supervise(
			ctx,
			signalTestTierTimeout,
			[]serveutil.SupervisedService{stuck},
			[]serveutil.SupervisedService{laterTier},
		)
	}()

	<-stuckStarted
	writeSignalTestHelperLine("READY\n")
	<-ctx.Done()
	writeSignalTestHelperLine("CANCELLED\n")

	err := <-done
	if !errors.Is(err, serveutil.ErrShutdownTimeout) {
		return errSignalWedgeResult
	}

	writeSignalTestHelperLine("WEDGE_ESCAPED\n")

	return nil
}

func writeSignalTestHelperLine(line string) {
	if _, err := os.Stdout.WriteString(line); err != nil {
		os.Exit(2)
	}
}

func waitForHelperLine(t *testing.T, lines <-chan string, want string) {
	t.Helper()

	select {
	case got := <-lines:
		if got != want {
			t.Fatalf("helper output = %q, want %q", got, want)
		}
	case <-time.After(signalTestProcessTimeout):
		t.Fatalf("timed out waiting for helper output %q", want)
	}
}
