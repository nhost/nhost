package dockercompose_test

import (
	"testing"

	"github.com/nhost/nhost/cli/dockercompose"
)

// The "auto" branch depends on the host OS and the reachable docker daemon,
// so it's in TestAutoUser.
func TestResolveHostUser(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{
			name:    "none",
			value:   dockercompose.HostUserNone,
			want:    "",
			wantErr: false,
		},
		{
			name:    "explicit uid:gid",
			value:   "1000:1000",
			want:    "1000:1000",
			wantErr: false,
		},
		{
			name:    "missing gid",
			value:   "1000",
			want:    "",
			wantErr: true,
		},
		{
			name:    "named user",
			value:   "postgres:postgres",
			want:    "",
			wantErr: true,
		},
		{
			name:    "typo",
			value:   "atuo",
			want:    "",
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := dockercompose.ResolveHostUser(t.Context(), tc.value)
			if (err != nil) != tc.wantErr {
				t.Fatalf("ResolveHostUser(%q) error = %v, wantErr %v", tc.value, err, tc.wantErr)
			}

			if got != tc.want {
				t.Errorf("ResolveHostUser(%q) = %q, want %q", tc.value, got, tc.want)
			}
		})
	}
}
