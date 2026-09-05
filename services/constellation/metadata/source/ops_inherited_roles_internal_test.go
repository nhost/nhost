package source

import (
	"errors"
	"slices"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// currentInheritedRoles re-parses the live snapshot so a test can assert on the
// post-mutation inherited-role slice.
func currentInheritedRoles(t *testing.T, s *Store) []hasura.InheritedRole {
	t.Helper()

	raw, _ := s.HasuraSnapshotJSON()

	h, err := hasura.FromJSON(raw)
	if err != nil {
		t.Fatalf("re-parsing snapshot: %v", err)
	}

	return h.InheritedRoles
}

func TestAddInheritedRole_AppendsAndReplaces(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	rv, code, err := s.AddInheritedRole(
		t.Context(), []byte(`{"role_name": "manager", "role_set": ["employee", "auditor"]}`),
	)
	if err != nil {
		t.Fatalf("AddInheritedRole: %v", err)
	}

	if code != "" {
		t.Errorf("code = %q, want empty", code)
	}

	if rv == 0 {
		t.Error("resource version not bumped")
	}

	roles := currentInheritedRoles(t, s)
	if len(roles) != 1 || roles[0].RoleName != "manager" {
		t.Fatalf("roles = %+v, want one named manager", roles)
	}

	// role_set is stored sorted (canonical, matching Hasura's export).
	if want := []string{"auditor", "employee"}; !slices.Equal(roles[0].RoleSet, want) {
		t.Errorf("role_set = %v, want %v", roles[0].RoleSet, want)
	}

	// Re-adding the same name replaces the role_set (Hasura insert semantics).
	if _, _, err := s.AddInheritedRole(
		t.Context(), []byte(`{"role_name": "manager", "role_set": ["employee"]}`),
	); err != nil {
		t.Fatalf("AddInheritedRole (replace): %v", err)
	}

	roles = currentInheritedRoles(t, s)
	if len(roles) != 1 {
		t.Fatalf("expected replace not append, got %d roles", len(roles))
	}

	if want := []string{"employee"}; !slices.Equal(roles[0].RoleSet, want) {
		t.Errorf("role_set after replace = %v, want %v", roles[0].RoleSet, want)
	}
}

func TestAddInheritedRole_RejectsSelfReference(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	_, _, err := s.AddInheritedRole(
		t.Context(), []byte(`{"role_name": "manager", "role_set": ["employee", "manager"]}`),
	)
	if !errors.Is(err, ErrInheritedRoleSelfReference) {
		t.Fatalf("err = %v, want ErrInheritedRoleSelfReference", err)
	}
}

func TestAddInheritedRole_RequiresFields(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	for _, args := range []string{
		`{"role_set": ["employee"]}`,
		`{"role_name": "manager"}`,
		`{"role_name": "manager", "role_set": []}`,
	} {
		if _, _, err := s.AddInheritedRole(t.Context(), []byte(args)); !errors.Is(
			err, errMissingRequiredField,
		) {
			t.Errorf("AddInheritedRole(%s) err = %v, want errMissingRequiredField", args, err)
		}
	}
}

func TestDropInheritedRole_RemovesAndReportsMissing(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	if _, _, err := s.AddInheritedRole(
		t.Context(), []byte(`{"role_name": "manager", "role_set": ["employee"]}`),
	); err != nil {
		t.Fatalf("AddInheritedRole: %v", err)
	}

	if _, _, err := s.DropInheritedRole(
		t.Context(), []byte(`{"role_name": "manager"}`),
	); err != nil {
		t.Fatalf("DropInheritedRole: %v", err)
	}

	if roles := currentInheritedRoles(t, s); len(roles) != 0 {
		t.Fatalf("expected no inherited roles after drop, got %+v", roles)
	}

	_, _, err := s.DropInheritedRole(t.Context(), []byte(`{"role_name": "ghost"}`))
	if !errors.Is(err, ErrInheritedRoleNotFound) {
		t.Fatalf("err = %v, want ErrInheritedRoleNotFound", err)
	}
}
