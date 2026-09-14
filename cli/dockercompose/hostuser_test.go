package dockercompose_test

import (
	"fmt"
	"os"
	"runtime"
	"testing"

	"github.com/nhost/nhost/cli/dockercompose"
)

func TestResolveHostUser(t *testing.T) {
	t.Setenv("DOCKER_HOST", "unix:///var/run/docker.sock")
	t.Setenv("PATH", t.TempDir())

	autoWant := ""
	if runtime.GOOS == "linux" {
		autoWant = fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid())
	}

	cases := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{
			name:    "auto",
			value:   dockercompose.HostUserAuto,
			want:    autoWant,
			wantErr: false,
		},
		{
			name:    "empty defaults to auto",
			value:   "",
			want:    autoWant,
			wantErr: false,
		},
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

	for _, tc := range cases { //nolint:paralleltest // subtests share the parent Docker environment
		t.Run(tc.name, func(t *testing.T) {
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
