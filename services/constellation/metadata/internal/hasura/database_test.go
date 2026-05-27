package hasura_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func TestDatabaseURL_IsFromEnv(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		url  hasura.DatabaseURL
		want bool
	}{
		{
			name: "from env",
			url:  hasura.DatabaseURL{FromEnv: "PG_URL", URL: ""},
			want: true,
		},
		{
			name: "direct url",
			url:  hasura.DatabaseURL{FromEnv: "", URL: "postgres://localhost"},
			want: false,
		},
		{
			name: "empty",
			url:  hasura.DatabaseURL{FromEnv: "", URL: ""},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := tt.url.IsFromEnv(); got != tt.want {
				t.Errorf("IsFromEnv() = %v, want %v", got, tt.want)
			}
		})
	}
}
