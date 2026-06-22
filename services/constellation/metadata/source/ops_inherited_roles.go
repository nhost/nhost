package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"slices"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opAddInheritedRole  = "add_inherited_role"
	opDropInheritedRole = "drop_inherited_role"
)

// ErrInheritedRoleNotFound is returned by drop_inherited_role when no inherited
// role with the given name exists.
var ErrInheritedRoleNotFound = errors.New("inherited role not found")

// ErrInheritedRoleSelfReference is returned by add_inherited_role when the
// inherited role names itself among its parents, matching Hasura's
// runAddInheritedRole guard ("an inherited role name cannot be in the role
// combination").
var ErrInheritedRoleSelfReference = errors.New(
	"an inherited role name cannot be in its own role_set",
)

// inheritedRoleArgs is the add_inherited_role payload. The parent roles are
// carried under "role_set" to match Hasura's wire format.
type inheritedRoleArgs struct {
	RoleName string   `json:"role_name"`
	RoleSet  []string `json:"role_set"`
}

func (a inheritedRoleArgs) validate() error {
	if a.RoleName == "" {
		return fmt.Errorf("%w: %s: role_name is required", errMissingRequiredField, opAddInheritedRole)
	}

	if len(a.RoleSet) == 0 {
		return fmt.Errorf("%w: %s: role_set is required", errMissingRequiredField, opAddInheritedRole)
	}

	if slices.Contains(a.RoleSet, a.RoleName) {
		return fmt.Errorf("%w: %q", ErrInheritedRoleSelfReference, a.RoleName)
	}

	return nil
}

func findInheritedRole(h *hasura.Metadata, name string) int {
	for i := range h.InheritedRoles {
		if h.InheritedRoles[i].RoleName == name {
			return i
		}
	}

	return -1
}

// AddInheritedRole adds (or replaces) a top-level inherited role. Re-adding an
// existing role name overwrites its role_set, matching Hasura's
// runAddInheritedRole, which inserts into an ordered map keyed by name.
func (s *Store) AddInheritedRole(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildAddInheritedRole(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildAddInheritedRole(argsJSON []byte) (MutationFn, error) {
	var args inheritedRoleArgs
	if err := json.Unmarshal(argsJSON, &args); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opAddInheritedRole, err)
	}

	if err := args.validate(); err != nil {
		return nil, err
	}

	// Sort the parent roles so storage (and therefore export) is canonical and
	// order-insensitive, matching Hasura, which stores role_set as a set and
	// emits it sorted on export.
	roleSet := slices.Clone(args.RoleSet)
	slices.Sort(roleSet)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		role := hasura.InheritedRole{RoleName: args.RoleName, RoleSet: roleSet}

		if i := findInheritedRole(h, args.RoleName); i >= 0 {
			h.InheritedRoles[i] = role

			return "", nil
		}

		h.InheritedRoles = append(h.InheritedRoles, role)

		return "", nil
	}, nil
}

// DropInheritedRole removes a top-level inherited role. Dropping a role that
// does not exist is reported as ErrInheritedRoleNotFound (Hasura's NotExists).
func (s *Store) DropInheritedRole(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildDropInheritedRole(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildDropInheritedRole(argsJSON []byte) (MutationFn, error) {
	var args struct {
		RoleName string `json:"role_name"`
	}
	if err := json.Unmarshal(argsJSON, &args); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opDropInheritedRole, err)
	}

	if args.RoleName == "" {
		return nil, fmt.Errorf(
			"%w: %s: role_name is required", errMissingRequiredField, opDropInheritedRole,
		)
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		i := findInheritedRole(h, args.RoleName)
		if i < 0 {
			return "", fmt.Errorf("%w: %q", ErrInheritedRoleNotFound, args.RoleName)
		}

		h.InheritedRoles = append(h.InheritedRoles[:i], h.InheritedRoles[i+1:]...)

		return "", nil
	}, nil
}
