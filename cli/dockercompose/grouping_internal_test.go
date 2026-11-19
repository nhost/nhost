package dockercompose

import (
	"testing"
)

func status(service string) ServiceStatus {
	return ServiceStatus{
		Service: service,
		State:   "",
		Health:  "",
		Status:  "",
	}
}

func TestCorePriority(t *testing.T) {
	t.Parallel()

	if got := CorePriority("constellation"); got != 2 {
		t.Errorf("CorePriority(constellation) = %d, want 2", got)
	}

	if got := CorePriority("graphql"); got != 1 {
		t.Errorf("CorePriority(graphql) = %d, want 1", got)
	}

	unknown := CorePriority("run-foo")
	if got := CorePriority("postgres"); unknown <= got {
		t.Errorf("CorePriority(run-foo) = %d, want greater than all known", unknown)
	}

	if unknown != len(coreOrder) {
		t.Errorf("CorePriority(run-foo) = %d, want %d", unknown, len(coreOrder))
	}
}

func TestGroupServicesSortsCoreAndPreservesStableOrder(t *testing.T) {
	t.Parallel()

	input := []ServiceStatus{
		status("dashboard"),
		status("run-b"),
		status("minio"),
		status("auth"),
		status("run-a"),
		status("constellation"),
		status("graphql"),
		status("traefik"),
		status("run-c"),
		status("postgres"),
	}

	core, infra := GroupServices(input)

	wantCore := []string{
		"postgres",
		"graphql",
		"constellation",
		"auth",
		"dashboard",
		"run-b",
		"run-a",
		"run-c",
	}

	if len(core) != len(wantCore) {
		t.Fatalf("core length = %d, want %d", len(core), len(wantCore))
	}

	for i, want := range wantCore {
		if core[i].Service != want {
			t.Errorf("core[%d] = %q, want %q", i, core[i].Service, want)
		}
	}

	wantInfra := []string{"minio", "traefik"}
	if len(infra) != len(wantInfra) {
		t.Fatalf("infra length = %d, want %d", len(infra), len(wantInfra))
	}

	for i, want := range wantInfra {
		if infra[i].Service != want {
			t.Errorf("infra[%d] = %q, want %q", i, infra[i].Service, want)
		}
	}
}
