package dockercompose_test

import (
	"testing"

	"github.com/nhost/nhost/cli/dockercompose"
)

func TestLocalPostgresDSN(t *testing.T) {
	t.Parallel()

	got := dockercompose.LocalPostgresDSN(5433)
	want := "postgres://postgres:postgres@localhost:5433/local"

	if got != want {
		t.Errorf("expected %q, got %q", want, got)
	}
}

func TestLocalServiceURL(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		service      string
		httpPort     uint
		postgresPort uint
		useTLS       bool
		want         string
	}{
		{
			name:         "postgres uses postgres port",
			service:      "postgres",
			httpPort:     443,
			postgresPort: 5433,
			useTLS:       true,
			want:         "localhost:5433",
		},
		{
			name:         "web service uses default tls URL",
			service:      "graphql",
			httpPort:     443,
			postgresPort: 5432,
			useTLS:       true,
			want:         "https://local.graphql.local.nhost.run",
		},
		{
			name:         "constellation maps to graphql tls URL",
			service:      "constellation",
			httpPort:     443,
			postgresPort: 5432,
			useTLS:       true,
			want:         "https://local.graphql.local.nhost.run",
		},
		{
			name:         "constellation maps to graphql URL with custom port",
			service:      "constellation",
			httpPort:     1337,
			postgresPort: 5432,
			useTLS:       false,
			want:         "http://local.graphql.local.nhost.run:1337",
		},
		{
			name:         "hasura service keeps custom port",
			service:      "hasura",
			httpPort:     8080,
			postgresPort: 5432,
			useTLS:       false,
			want:         "http://local.hasura.local.nhost.run:8080",
		},
		{
			name:         "console service maps to hasura URL",
			service:      "console",
			httpPort:     8080,
			postgresPort: 5432,
			useTLS:       false,
			want:         "http://local.hasura.local.nhost.run:8080",
		},
		{
			name:         "unknown service",
			service:      "unknown",
			httpPort:     443,
			postgresPort: 5432,
			useTLS:       true,
			want:         "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := dockercompose.LocalServiceURL(
				"local",
				tc.service,
				tc.httpPort,
				tc.postgresPort,
				tc.useTLS,
			)

			if got != tc.want {
				t.Errorf("expected %q, got %q", tc.want, got)
			}
		})
	}
}
