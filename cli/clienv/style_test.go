package clienv_test

import (
	"bytes"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

func TestStdout(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	ce := clienv.New(&output, &output, nil, "", "", "", "", "", "", "")

	if _, err := ce.Stdout().Write([]byte("written directly")); err != nil {
		t.Fatalf("write: %v", err)
	}

	ce.Println("written through Println")

	want := "written directlywritten through Println\n"
	if output.String() != want {
		t.Errorf("output = %q, want %q", output.String(), want)
	}
}
