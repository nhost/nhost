package dockercompose //nolint:testpackage

import (
	"strings"
	"testing"
)

func TestPgDumpVersionMismatch(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		output  string
		wantErr bool
	}{
		{
			name: "server version mismatch",
			output: `FATA[0001] cannot fetch schema dump: pg_dump request: 500 ` +
				`{"error":"error while executing pg_dump","internal":` +
				`"pg_dump: error: aborting because of server version mismatch\n` +
				`pg_dump: detail: server version: 18.1; pg_dump version: 17.6\n"}`,
			wantErr: true,
		},
		{
			name:    "unrelated pg_dump error",
			output:  "pg_dump: error: connection to server failed",
			wantErr: false,
		},
		{
			name:    "success output",
			output:  "INFO migrations created\n",
			wantErr: false,
		},
		{
			name:    "empty output",
			output:  "",
			wantErr: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := pgDumpVersionMismatch(tc.output)
			if tc.wantErr && err == nil {
				t.Fatalf("expected an error, got nil")
			}

			if !tc.wantErr && err != nil {
				t.Fatalf("expected nil error, got: %v", err)
			}
		})
	}
}

func TestTailBufferCapsRetainedBytes(t *testing.T) {
	t.Parallel()

	b := new(tailBuffer)

	// Write more than the cap in small chunks; only the tail must survive.
	total := tailBufferMax + 4096
	chunk := strings.Repeat("a", 1024)

	for written := 0; written < total; written += len(chunk) {
		if _, err := b.Write([]byte(chunk)); err != nil {
			t.Fatalf("write failed: %v", err)
		}
	}

	if got := len(b.String()); got != tailBufferMax {
		t.Fatalf("tail buffer length = %d, want %d", got, tailBufferMax)
	}

	// The most recent write must be searchable in the retained tail.
	if _, err := b.Write([]byte("server version mismatch")); err != nil {
		t.Fatalf("write failed: %v", err)
	}

	if !strings.Contains(b.String(), "server version mismatch") {
		t.Error("expected recent write to be retained in tail buffer")
	}
}
