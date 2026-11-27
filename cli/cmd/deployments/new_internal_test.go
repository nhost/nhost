package deployments

import (
	"bytes"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestPrintNewDeploymentJSON(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		id     string
		status string
		want   string
	}{
		{
			name:   "with status",
			id:     "a1b2c3",
			status: "SUCCEEDED",
			want:   `{"id":"a1b2c3","status":"SUCCEEDED"}` + "\n",
		},
		{
			name:   "status unknown after following the logs failed",
			id:     "a1b2c3",
			status: "",
			want:   `{"id":"a1b2c3"}` + "\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer
			if err := printNewDeploymentJSON(&buf, tt.id, tt.status); err != nil {
				t.Fatalf("printNewDeploymentJSON() error = %v", err)
			}

			if diff := cmp.Diff(tt.want, buf.String()); diff != "" {
				t.Errorf("printNewDeploymentJSON() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
