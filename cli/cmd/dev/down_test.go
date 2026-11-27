package dev //nolint:testpackage

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

type stubComposeStopper struct {
	err        error
	called     bool
	gotVolumes bool
}

func (s *stubComposeStopper) Stop(_ context.Context, volumes bool) error {
	s.called = true
	s.gotVolumes = volumes

	return s.err
}

func TestStopDevEnvironment(t *testing.T) {
	t.Parallel()

	stopErr := errors.New("docker compose down failed")

	cases := []struct {
		name       string
		volumes    bool
		stopErr    error
		expectErr  bool
		expectWarn string
	}{
		{
			name:       "succeeds without volumes",
			volumes:    false,
			stopErr:    nil,
			expectErr:  false,
			expectWarn: "",
		},
		{
			name:       "succeeds with volumes",
			volumes:    true,
			stopErr:    nil,
			expectErr:  false,
			expectWarn: "",
		},
		{
			name:       "returns error when stop fails",
			volumes:    false,
			stopErr:    stopErr,
			expectErr:  true,
			expectWarn: "failed to stop Nhost development environment: docker compose down failed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var stdout, stderr bytes.Buffer

			ce := clienv.New(&stdout, &stderr, nil, "", "", "", "", "", "", "")
			stopper := &stubComposeStopper{
				err:        tc.stopErr,
				called:     false,
				gotVolumes: false,
			}

			err := stopDevEnvironment(t.Context(), ce, stopper, tc.volumes)
			if !stopper.called {
				t.Fatal("expected Stop to be called")
			}

			if stopper.gotVolumes != tc.volumes {
				t.Errorf("expected volumes=%v, got %v", tc.volumes, stopper.gotVolumes)
			}

			if tc.expectErr {
				if err == nil {
					t.Fatal("expected error but got nil")
				}

				if !errors.Is(err, tc.stopErr) {
					t.Errorf("expected error to wrap %v, got %v", tc.stopErr, err)
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.expectWarn != "" && !strings.Contains(stdout.String(), tc.expectWarn) {
				t.Errorf("expected stdout to contain %q, got %q", tc.expectWarn, stdout.String())
			}
		})
	}
}
