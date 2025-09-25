package clamd_test

import (
	"testing"

	"github.com/nhost/hasura-storage/clamd"
)

func TestClamdReload(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
	}{
		{
			name: "success",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			client, err := clamd.NewClient("tcp://localhost:3310")
			if err != nil {
				t.Fatalf("failed to dial: %v", err)
			}

			if err := client.Reload(t.Context()); err != nil {
				t.Fatalf("failed to get version: %v", err)
			}
		})
	}
}
