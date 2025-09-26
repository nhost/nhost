package clamd_test

import (
	"testing"

	"github.com/nhost/hasura-storage/clamd"
)

func TestClamdVersion(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		expected clamd.Version
	}{
		{
			name: "success",
			expected: clamd.Version{
				Version: "1.1.0",
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

			version, err := client.Version(t.Context())
			if err != nil {
				t.Fatalf("failed to get version: %v", err)
			}

			if version.Version == "" {
				t.Fatalf("version.Version is empty")
			}
		})
	}
}
