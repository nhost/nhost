package project

import (
	"encoding/json"
	"testing"

	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

func TestCollectProjectsEmptyEncodesAsArray(t *testing.T) {
	t.Parallel()

	var orgs graphql.GetOrganizationsAndWorkspacesApps

	projects := collectProjects(&orgs)
	if projects == nil {
		t.Fatal("expected empty project list to be non-nil")
	}

	if len(projects) != 0 {
		t.Fatalf("expected no projects, got %d", len(projects))
	}

	encoded, err := json.Marshal(projects)
	if err != nil {
		t.Fatalf("marshal projects: %v", err)
	}

	if got, want := string(encoded), "[]"; got != want {
		t.Fatalf("expected JSON %s, got %s", want, got)
	}
}
