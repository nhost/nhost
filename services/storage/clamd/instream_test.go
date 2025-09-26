package clamd_test

import (
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/clamd"
)

func TestClamdInstream(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		filepath      string
		expectedError error
	}{
		{
			name:     "clean",
			filepath: "clamd.go",
		},
		{
			name:     "eicarcom2.zip",
			filepath: "testdata/eicarcom2.zip",
			expectedError: &clamd.VirusFoundError{
				Name: "Win.Test.EICAR_HDB-1",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			client, err := clamd.NewClient("tcp://localhost:3310")
			if err != nil {
				t.Fatalf("failed to dial: %v", err)
			}

			f, err := os.Open(tc.filepath)
			if err != nil {
				t.Fatalf("failed to open file: %v", err)
			}
			defer f.Close()

			err = client.InStream(t.Context(), f)
			if diff := cmp.Diff(tc.expectedError, err); diff != "" {
				t.Errorf("unexpected error (-want +got):\n%s", diff)
			}
		})
	}
}
