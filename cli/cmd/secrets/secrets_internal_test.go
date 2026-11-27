package secrets

import (
	"bytes"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestPrintSecretResultJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		secretName string
		status     string
		want       string
	}{
		{
			name:       "created",
			secretName: "STRIPE_KEY",
			status:     "created",
			want:       `{"name":"STRIPE_KEY","status":"created"}` + "\n",
		},
		{
			name:       "deleted",
			secretName: "OLD_KEY",
			status:     "deleted",
			want:       `{"name":"OLD_KEY","status":"deleted"}` + "\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer
			if err := printSecretResultJSON(&buf, tt.secretName, tt.status); err != nil {
				t.Fatalf("printSecretResultJSON() error = %v", err)
			}

			if diff := cmp.Diff(tt.want, buf.String()); diff != "" {
				t.Errorf("printSecretResultJSON() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
