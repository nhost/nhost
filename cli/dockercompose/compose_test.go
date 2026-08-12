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

func TestVolumeSELinuxRelabel(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		volume   dockercompose.Volume
		expected string
	}{
		{
			// A shared SELinux relabel ("z") is emitted as the long-form
			// bind.selinux option so the docker socket is accessible on
			// SELinux/Podman hosts.
			name: "with selinux relabel",
			volume: dockercompose.Volume{
				Type:     "bind",
				Source:   "/var/run/docker.sock",
				Target:   "/var/run/docker.sock",
				ReadOnly: new(true),
				Bind:     &dockercompose.BindOptions{SELinux: "z"},
			},
			expected: `type: bind
source: /var/run/docker.sock
target: /var/run/docker.sock
read_only: true
bind:
    selinux: z
`,
		},
		{
			// Without Bind, the bind mapping is omitted entirely so
			// non-SELinux hosts see the unchanged output.
			name: "without bind options",
			volume: dockercompose.Volume{
				Type:     "bind",
				Source:   "/opt/traefik",
				Target:   "/opt/traefik",
				ReadOnly: new(true),
			},
			expected: `type: bind
source: /opt/traefik
target: /opt/traefik
read_only: true
`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := yaml.Marshal(tc.volume)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}

			if diff := cmp.Diff(tc.expected, string(got)); diff != "" {
				t.Error(diff)
			}
		})
	}
}
