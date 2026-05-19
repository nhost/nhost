package dockercompose_test

import (
	"maps"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/dockercompose"
	"gopkg.in/yaml.v3"
)

func TestServiceEnvironmentEscapesDollar(t *testing.T) {
	t.Parallel()

	env := dockercompose.Environment{
		"PLAIN":               "no-dollar",
		"HASURA_ADMIN_SECRET": "secret$with$dollars",
		"ALREADY_ESCAPED":     "a$$b",
	}
	original := maps.Clone(env)

	svc := &dockercompose.Service{
		Image:       "nhost/example:1.0",
		DependsOn:   nil,
		EntryPoint:  nil,
		Command:     nil,
		Environment: env,
		ExtraHosts:  []string{"host.docker.internal:host-gateway"},
		HealthCheck: nil,
		Labels:      nil,
		Networks:    nil,
		Ports:       nil,
		Restart:     "always",
		Volumes:     nil,
		WorkingDir:  nil,
	}

	got, err := yaml.Marshal(svc)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	expected := `image: nhost/example:1.0
environment:
    ALREADY_ESCAPED: a$$$$b
    HASURA_ADMIN_SECRET: secret$$with$$dollars
    PLAIN: no-dollar
extra_hosts:
    - host.docker.internal:host-gateway
restart: always
`

	if diff := cmp.Diff(expected, string(got)); diff != "" {
		t.Error(diff)
	}

	if diff := cmp.Diff(original, env); diff != "" {
		t.Errorf("source Environment map was mutated by marshal: %s", diff)
	}
}
