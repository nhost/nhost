package dev //nolint:testpackage

import (
	"strings"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/dockercompose"
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
