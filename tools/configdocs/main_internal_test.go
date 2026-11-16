package main

import (
	"strings"
	"testing"
)

func TestGenerate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		schema  string
		want    string
		wantErr string
	}{
		{
			name:    "invalid cue",
			schema:  "#Config: {",
			wantErr: "parse cue",
		},
		{
			name:    "missing root",
			schema:  "#Other: {}",
			wantErr: errMissingConfig.Error(),
		},
		{
			name:    "non-struct root",
			schema:  "#Config: string",
			wantErr: errInvalidConfig.Error(),
		},
		{
			name: "valid root",
			schema: `#Config: { auth: #Auth }
#Auth: { enabled: bool | *true }
`,
			want: "| [`auth`](#auth) |",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := generate("schema.cue", []byte(tt.schema))
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("generate() error = %v, want to contain %q", err, tt.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatalf("generate() error = %v", err)
			}

			if !strings.Contains(got, tt.want) {
				t.Errorf("generate() output does not contain %q", tt.want)
			}
		})
	}
}
