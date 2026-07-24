package dockercompose_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/dockercompose"
)

func TestDockerComposeLocalDevelopmentConfig(t *testing.T) {
	t.Parallel()

	composePath := filepath.Join(t.TempDir(), "docker-compose.yaml")
	compose := `services:
    traefik:
        ports:
            - mode: ingress
              target: 8080
              published: "8080"
              protocol: tcp
    graphql:
        labels:
            traefik.http.routers.graphql.tls: "false"
    postgres:
        ports:
            - mode: ingress
              target: 5432
              published: "15432"
              protocol: tcp
volumes: {}
`

	if err := os.WriteFile(composePath, []byte(compose), 0o600); err != nil {
		t.Fatalf("write compose file: %v", err)
	}

	dc := dockercompose.New(t.TempDir(), composePath, "test")

	got, err := dc.LocalDevelopmentConfig()
	if err != nil {
		t.Fatalf("local development config: %v", err)
	}

	want := dockercompose.LocalDevelopmentConfig{
		HTTPPort:     8080,
		UseTLS:       false,
		PostgresPort: 15432,
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("unexpected local development config (-want +got):\n%s", diff)
	}
}

func TestDockerComposeLocalDevelopmentConfigWithoutPostgres(t *testing.T) {
	t.Parallel()

	composePath := filepath.Join(t.TempDir(), "docker-compose.yaml")
	compose := `services:
    traefik:
        ports:
            - mode: ingress
              target: 8080
              published: "8080"
              protocol: tcp
    console:
        labels:
            traefik.http.routers.hasura.tls: "true"
volumes: {}
`

	if err := os.WriteFile(composePath, []byte(compose), 0o600); err != nil {
		t.Fatalf("write compose file: %v", err)
	}

	dc := dockercompose.New(t.TempDir(), composePath, "test")

	got, err := dc.LocalDevelopmentConfig()
	if err != nil {
		t.Fatalf("local development config: %v", err)
	}

	want := dockercompose.LocalDevelopmentConfig{
		HTTPPort:     8080,
		UseTLS:       true,
		PostgresPort: 0,
	}

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("unexpected local development config (-want +got):\n%s", diff)
	}
}
