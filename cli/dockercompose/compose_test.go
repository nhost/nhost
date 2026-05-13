package dockercompose_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/dockercompose"
	"gopkg.in/yaml.v3"
)

func TestServiceEnvironmentEscapesDollar(t *testing.T) {
	t.Parallel()

	svc := &dockercompose.Service{
		Image: "nhost/example:1.0",
		Environment: dockercompose.Environment{
			"PLAIN":               "no-dollar",
			"HASURA_ADMIN_SECRET": "secret$with$dollars",
		},
		ExtraHosts: []string{"host.docker.internal:host-gateway"},
		Restart:    "always",
	}

	got, err := yaml.Marshal(svc)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	expected := `image: nhost/example:1.0
environment:
    HASURA_ADMIN_SECRET: secret$$with$$dollars
    PLAIN: no-dollar
extra_hosts:
    - host.docker.internal:host-gateway
restart: always
`

	if diff := cmp.Diff(expected, string(got)); diff != "" {
		t.Error(diff)
	}
}
