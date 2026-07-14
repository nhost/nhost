package clienv_test

import (
	"bytes"
	"io"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

func TestWithStdoutReturnsIndependentCopy(t *testing.T) {
	t.Parallel()

	var (
		original    bytes.Buffer
		replacement bytes.Buffer
	)

	ce := clienv.New(
		&original,
		io.Discard,
		clienv.NewPathStructure("", "", "", ""),
		"",
		"",
		"",
		"",
		"",
		"",
		"local",
	)

	clone := ce.WithStdout(&replacement)
	if clone == ce {
		t.Fatal("WithStdout returned the original CliEnv")
	}

	if ce.Stdout() != &original {
		t.Fatal("WithStdout changed the original stdout writer")
	}

	if clone.Stdout() != &replacement {
		t.Fatal("WithStdout did not set the clone stdout writer")
	}

	clone.Println("clone output")
	ce.Println("original output")

	if got := original.String(); got != "original output\n" {
		t.Fatalf("original stdout buffer = %q, want %q", got, "original output\n")
	}

	if got := replacement.String(); got != "clone output\n" {
		t.Fatalf("clone stdout buffer = %q, want %q", got, "clone output\n")
	}
}
