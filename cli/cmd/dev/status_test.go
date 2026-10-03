package dev //nolint:testpackage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/dockercompose"
	"gopkg.in/yaml.v3"
)

func TestPrintInfo(t *testing.T) {
	t.Parallel()

	got := printInfo("myapp", 8443, 5433, false, []*dockercompose.RunService{{
		Config: &model.ConfigRunServiceConfig{
			Name:        "bun-gen",
			Image:       nil,
			Command:     nil,
			Environment: nil,
			Ports: []*model.ConfigRunServicePort{
				{
					Port:      5000,
					Type:      "http",
					Publish:   new(true),
					Ingresses: nil,
					RateLimit: nil,
				},
				{
					Port:      3000,
					Type:      "tcp",
					Publish:   new(false),
					Ingresses: nil,
					RateLimit: nil,
				},
			},
			Resources:   nil,
			HealthCheck: nil,
		},
		Path:       "/tmp/run.toml",
		BindMounts: nil,
	}})

	for _, want := range []string{
		"postgres://postgres:postgres@localhost:5433/local",
		"http://myapp.hasura.local.nhost.run:8443",
		"http://myapp.graphql.local.nhost.run:8443",
		"http://localhost:5000",
		"http://run-bun-gen:5000",
		"Subdomain:",
		"myapp",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q\n%s", want, got)
		}
	}

	if strings.Contains(got, "3000") {
		t.Errorf("unpublished port was printed:\n%s", got)
	}
}

func TestInfoFromCompose(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		subdomain  string
		httpPort   string
		httpTarget uint
		postgres   string
		tls        string
		want       []string
	}{
		{
			name:       "custom ports",
			subdomain:  "myapp",
			httpPort:   "8443",
			httpTarget: 8443,
			postgres:   "5433",
			tls:        "false",
			want: []string{
				"postgres://postgres:postgres@localhost:5433/local",
				"http://myapp.hasura.local.nhost.run:8443",
			},
		},
		{
			name:       "default ports",
			subdomain:  "local",
			httpPort:   "443",
			httpTarget: 443,
			postgres:   "5432",
			tls:        "true",
			want: []string{
				"postgres://postgres:postgres@localhost:5432/local",
				"https://local.hasura.local.nhost.run",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			file := dockercompose.ComposeFile{
				Services: map[string]*dockercompose.Service{
					"traefik": {
						Networks: map[string]*dockercompose.NetworkConfig{
							"default": {
								Aliases: []string{tt.subdomain + ".hasura.local.nhost.run"},
							},
						},
						Ports: []dockercompose.Port{{
							Published: tt.httpPort,
							Target:    tt.httpTarget,
							Protocol:  "tcp",
						}},
					},
					"hasura": {
						Labels: map[string]string{
							"traefik.http.routers.hasura.tls": tt.tls,
						},
					},
					"postgres": {
						Ports: []dockercompose.Port{{
							Published: tt.postgres,
							Target:    5432,
							Protocol:  "tcp",
						}},
					},
				},
			}

			body, err := yaml.Marshal(file)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}

			path := filepath.Join(t.TempDir(), "docker-compose.yaml")
			if err := os.WriteFile(path, body, 0o644); err != nil {
				t.Fatalf("write: %v", err)
			}

			got, err := infoFromCompose(path)
			if err != nil {
				t.Fatalf("info: %v", err)
			}

			for _, want := range tt.want {
				if !strings.Contains(got, want) {
					t.Errorf("missing %q\n%s", want, got)
				}
			}

			if tt.tls == "true" && strings.Contains(got, ":443") {
				t.Errorf("default TLS URL included the port:\n%s", got)
			}
		})
	}
}
