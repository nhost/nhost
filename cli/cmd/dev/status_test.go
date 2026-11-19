package dev //nolint:testpackage

import (
	"io"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/dockercompose"
)

func TestBuildStatusOutputUsesServiceStatesForOverallStatus(t *testing.T) {
	t.Parallel()

	ce := statusTestEnv()
	localConfig := dockercompose.LocalDevelopmentConfig{
		HTTPPort:     defaultHTTPPort,
		UseTLS:       true,
		PostgresPort: defaultPostgresPort,
	}

	tests := []struct {
		name     string
		services []dockercompose.ServiceStatus
		want     string
	}{
		{
			name:     "no services",
			services: nil,
			want:     statusStopped,
		},
		{
			name: "only exited containers",
			services: []dockercompose.ServiceStatus{
				serviceStatus("graphql", "exited", ""),
				serviceStatus("auth", "created", ""),
			},
			want: statusStopped,
		},
		{
			name: "running container",
			services: []dockercompose.ServiceStatus{
				serviceStatus("graphql", "running", ""),
			},
			want: statusRunning,
		},
		{
			name: "healthy container without running state",
			services: []dockercompose.ServiceStatus{
				serviceStatus("graphql", "", healthHealthy),
			},
			want: statusRunning,
		},
		{
			name: "mixed running and exited containers",
			services: []dockercompose.ServiceStatus{
				serviceStatus("graphql", "running", ""),
				serviceStatus("auth", "exited", ""),
			},
			want: statusDegraded,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			out := buildStatusOutput(ce, tc.services, localConfig)

			if out.Status != tc.want {
				t.Errorf("expected overall status %q, got %q", tc.want, out.Status)
			}
		})
	}
}

func TestBuildStatusOutputUsesLocalDevelopmentConfigForURLs(t *testing.T) {
	t.Parallel()

	ce := statusTestEnv()
	localConfig := dockercompose.LocalDevelopmentConfig{
		HTTPPort:     8080,
		UseTLS:       false,
		PostgresPort: 15432,
	}

	out := buildStatusOutput(
		ce,
		[]dockercompose.ServiceStatus{
			serviceStatus("postgres", statusRunning, ""),
			serviceStatus("graphql", statusRunning, ""),
			serviceStatus("console", statusRunning, ""),
		},
		localConfig,
	)

	assertStatusServiceURL(t, out.Services, "postgres", "localhost:15432")
	assertStatusServiceURL(
		t,
		out.Services,
		"graphql",
		"http://local.graphql.local.nhost.run:8080",
	)
	assertStatusServiceURL(
		t,
		out.Infrastructure,
		"console",
		"http://local.hasura.local.nhost.run:8080",
	)
}

func assertStatusServiceURL(
	t *testing.T,
	services []statusService,
	name string,
	want string,
) {
	t.Helper()

	for _, service := range services {
		if service.Name != name {
			continue
		}

		if service.URL != want {
			t.Errorf("expected %s URL %q, got %q", name, want, service.URL)
		}

		return
	}

	t.Errorf("expected service %s in status output", name)
}

func statusTestEnv() *clienv.CliEnv {
	return clienv.New(
		io.Discard,
		io.Discard,
		clienv.NewPathStructure("", "", "", ""),
		"",
		"",
		"",
		"",
		"",
		"local",
		"local",
	)
}

func serviceStatus(service, state, health string) dockercompose.ServiceStatus {
	return dockercompose.ServiceStatus{
		Service: service,
		State:   state,
		Health:  health,
		Status:  "",
	}
}
