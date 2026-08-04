package source

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// ErrPermissionNotFound is returned by pg_drop_*_permission when the
// requested (role, table) permission is not configured. The dispatcher
// maps it to the Hasura error code "not-exists".
var ErrPermissionNotFound = errors.New("permission not found")

// ErrPermissionExists is returned when a permission for the role already exists
// with a different definition. The dispatcher maps it to the "already-exists"
// 400 code.
var ErrPermissionExists = errors.New("permission already exists")

const (
	opPgCreateSelectPermission = "pg_create_select_permission"
	opPgDropSelectPermission   = "pg_drop_select_permission"
	opPgCreateInsertPermission = "pg_create_insert_permission"
	opPgDropInsertPermission   = "pg_drop_insert_permission"
	opPgCreateUpdatePermission = "pg_create_update_permission"
	opPgDropUpdatePermission   = "pg_drop_update_permission"
	opPgCreateDeletePermission = "pg_create_delete_permission"
	opPgDropDeletePermission   = "pg_drop_delete_permission"
)

// pgPermissionTarget captures the (source, table, role) tuple shared by
// every create/drop permission op. The dispatcher's per-op buildXxx
// parses into this plus the action-specific Permission field.
type pgPermissionTarget struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	Role   string             `json:"role"`
}

func (t pgPermissionTarget) validate(op string) error {
	if t.Table.Schema == "" || t.Table.Name == "" || t.Role == "" {
		return fmt.Errorf(
			"%w: %s: table.schema, table.name and role are required",
			errMissingRequiredField, op,
		)
	}

	return nil
}

// resolveTable is the shared lookup used by every permission op: locate
// the source, locate the table, return the *TableMetadata so the
// mutator can append/remove from one of its permission slices.
func resolveTable(
	h *hasura.Metadata, source string, table hasura.TableSource,
) (*hasura.TableMetadata, error) {
	db := findDatabase(h, source)
	if db == nil {
		return nil, fmt.Errorf("%w: %q", ErrSourceNotFound, source)
	}

	t := findTable(db, table)
	if t == nil {
		return nil, fmt.Errorf("%w: %s.%s", ErrTableNotTracked, table.Schema, table.Name)
	}

	return t, nil
}

// permissionsEqual reports whether two permission configs are semantically
// identical by comparing their canonical JSON encodings. Each *PermissionConfig
// MarshalJSON re-emits modeled fields and captured unknown sibling keys
// deterministically (json.Deterministic), so the comparison is order-insensitive.
// reflect.DeepEqual is unsuitable here: the stored permission's Unknown bytes are
// the deterministically re-marshalled snapshot, while the incoming request's
// Unknown bytes are verbatim, so a semantically-identical re-create carrying an
// unmodeled key in non-sorted order would compare unequal and return a spurious
// 400 already-exists instead of the idempotent 200.
func permissionsEqual(stored, incoming any) (bool, error) {
	storedJSON, err := json.Marshal(stored)
	if err != nil {
		return false, fmt.Errorf("marshaling stored permission for comparison: %w", err)
	}

	incomingJSON, err := json.Marshal(incoming)
	if err != nil {
		return false, fmt.Errorf("marshaling incoming permission for comparison: %w", err)
	}

	return bytes.Equal(storedJSON, incomingJSON), nil
}

// indexOfPermission returns the index of role in perms, or -1.
func indexOfPermission[P any](perms []P, role string, roleOf func(P) string) int {
	for i, p := range perms {
		if roleOf(p) == role {
			return i
		}
	}

	return -1
}

// ===== select =====

type pgSelectPermissionArgs struct {
	pgPermissionTarget

	Permission hasura.SelectPermissionConfig `json:"permission"`
}

//nolint:dupl // intentional mirror of the other buildPgCreate*Permission ops; one per action.
func buildPgCreateSelectPermission(argsJSON []byte) (MutationFn, error) {
	var a pgSelectPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateSelectPermission, err)
	}

	if err := a.validate(opPgCreateSelectPermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		if idx := indexOfPermission(
			t.SelectPermissions,
			a.Role,
			func(p hasura.SelectPermission) string { return p.Role },
		); idx >= 0 {
			equal, err := permissionsEqual(t.SelectPermissions[idx].Permission, a.Permission)
			if err != nil {
				return "", err
			}

			if equal {
				return CodeAlreadyExists, nil
			}

			return "", fmt.Errorf(
				"%w: select permission for role %q already exists with a different definition",
				ErrPermissionExists, a.Role,
			)
		}

		t.SelectPermissions = append(
			t.SelectPermissions,
			hasura.SelectPermission{
				Role:       a.Role,
				Permission: a.Permission,
				Unknown:    nil,
			},
		)

		return "", nil
	}, nil
}

func buildPgDropSelectPermission(argsJSON []byte) (MutationFn, error) {
	var a pgPermissionTarget
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropSelectPermission, err)
	}

	if err := a.validate(opPgDropSelectPermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		idx := indexOfPermission(
			t.SelectPermissions,
			a.Role,
			func(p hasura.SelectPermission) string {
				return p.Role
			},
		)
		if idx < 0 {
			return "", fmt.Errorf("%w: select on %s.%s for role %q",
				ErrPermissionNotFound, a.Table.Schema, a.Table.Name, a.Role)
		}

		t.SelectPermissions = append(t.SelectPermissions[:idx], t.SelectPermissions[idx+1:]...)

		return "", nil
	}, nil
}

// PgCreateSelectPermission applies a pg_create_select_permission.
func (s *Store) PgCreateSelectPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateSelectPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// PgDropSelectPermission applies a pg_drop_select_permission.
func (s *Store) PgDropSelectPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropSelectPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== insert =====

type pgInsertPermissionArgs struct {
	pgPermissionTarget

	Permission hasura.InsertPermissionConfig `json:"permission"`
}

//nolint:dupl // intentional mirror of the other buildPgCreate*Permission ops; one per action.
func buildPgCreateInsertPermission(argsJSON []byte) (MutationFn, error) {
	var a pgInsertPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateInsertPermission, err)
	}

	if err := a.validate(opPgCreateInsertPermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		if idx := indexOfPermission(
			t.InsertPermissions,
			a.Role,
			func(p hasura.InsertPermission) string { return p.Role },
		); idx >= 0 {
			equal, err := permissionsEqual(t.InsertPermissions[idx].Permission, a.Permission)
			if err != nil {
				return "", err
			}

			if equal {
				return CodeAlreadyExists, nil
			}

			return "", fmt.Errorf(
				"%w: insert permission for role %q already exists with a different definition",
				ErrPermissionExists, a.Role,
			)
		}

		t.InsertPermissions = append(
			t.InsertPermissions,
			hasura.InsertPermission{
				Role:       a.Role,
				Permission: a.Permission,
				Unknown:    nil,
			},
		)

		return "", nil
	}, nil
}

func buildPgDropInsertPermission(argsJSON []byte) (MutationFn, error) {
	var a pgPermissionTarget
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropInsertPermission, err)
	}

	if err := a.validate(opPgDropInsertPermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		idx := indexOfPermission(
			t.InsertPermissions,
			a.Role,
			func(p hasura.InsertPermission) string {
				return p.Role
			},
		)
		if idx < 0 {
			return "", fmt.Errorf("%w: insert on %s.%s for role %q",
				ErrPermissionNotFound, a.Table.Schema, a.Table.Name, a.Role)
		}

		t.InsertPermissions = append(t.InsertPermissions[:idx], t.InsertPermissions[idx+1:]...)

		return "", nil
	}, nil
}

// PgCreateInsertPermission applies a pg_create_insert_permission.
func (s *Store) PgCreateInsertPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateInsertPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// PgDropInsertPermission applies a pg_drop_insert_permission.
func (s *Store) PgDropInsertPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropInsertPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== update =====

type pgUpdatePermissionArgs struct {
	pgPermissionTarget

	Permission hasura.UpdatePermissionConfig `json:"permission"`
}

//nolint:dupl // intentional mirror of the other buildPgCreate*Permission ops; one per action.
func buildPgCreateUpdatePermission(argsJSON []byte) (MutationFn, error) {
	var a pgUpdatePermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateUpdatePermission, err)
	}

	if err := a.validate(opPgCreateUpdatePermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		if idx := indexOfPermission(
			t.UpdatePermissions,
			a.Role,
			func(p hasura.UpdatePermission) string { return p.Role },
		); idx >= 0 {
			equal, err := permissionsEqual(t.UpdatePermissions[idx].Permission, a.Permission)
			if err != nil {
				return "", err
			}

			if equal {
				return CodeAlreadyExists, nil
			}

			return "", fmt.Errorf(
				"%w: update permission for role %q already exists with a different definition",
				ErrPermissionExists, a.Role,
			)
		}

		t.UpdatePermissions = append(
			t.UpdatePermissions,
			hasura.UpdatePermission{
				Role:       a.Role,
				Permission: a.Permission,
				Unknown:    nil,
			},
		)

		return "", nil
	}, nil
}

func buildPgDropUpdatePermission(argsJSON []byte) (MutationFn, error) {
	var a pgPermissionTarget
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropUpdatePermission, err)
	}

	if err := a.validate(opPgDropUpdatePermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		idx := indexOfPermission(
			t.UpdatePermissions,
			a.Role,
			func(p hasura.UpdatePermission) string {
				return p.Role
			},
		)
		if idx < 0 {
			return "", fmt.Errorf("%w: update on %s.%s for role %q",
				ErrPermissionNotFound, a.Table.Schema, a.Table.Name, a.Role)
		}

		t.UpdatePermissions = append(t.UpdatePermissions[:idx], t.UpdatePermissions[idx+1:]...)

		return "", nil
	}, nil
}

// PgCreateUpdatePermission applies a pg_create_update_permission.
func (s *Store) PgCreateUpdatePermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateUpdatePermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// PgDropUpdatePermission applies a pg_drop_update_permission.
func (s *Store) PgDropUpdatePermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropUpdatePermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== delete =====

type pgDeletePermissionArgs struct {
	pgPermissionTarget

	Permission hasura.DeletePermissionConfig `json:"permission"`
}

//nolint:dupl // intentional mirror of the other buildPgCreate*Permission ops; one per action.
func buildPgCreateDeletePermission(argsJSON []byte) (MutationFn, error) {
	var a pgDeletePermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateDeletePermission, err)
	}

	if err := a.validate(opPgCreateDeletePermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		if idx := indexOfPermission(
			t.DeletePermissions,
			a.Role,
			func(p hasura.DeletePermission) string { return p.Role },
		); idx >= 0 {
			equal, err := permissionsEqual(t.DeletePermissions[idx].Permission, a.Permission)
			if err != nil {
				return "", err
			}

			if equal {
				return CodeAlreadyExists, nil
			}

			return "", fmt.Errorf(
				"%w: delete permission for role %q already exists with a different definition",
				ErrPermissionExists, a.Role,
			)
		}

		t.DeletePermissions = append(
			t.DeletePermissions,
			hasura.DeletePermission{
				Role:       a.Role,
				Permission: a.Permission,
				Unknown:    nil,
			},
		)

		return "", nil
	}, nil
}

func buildPgDropDeletePermission(argsJSON []byte) (MutationFn, error) {
	var a pgPermissionTarget
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropDeletePermission, err)
	}

	if err := a.validate(opPgDropDeletePermission); err != nil {
		return nil, err
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		idx := indexOfPermission(
			t.DeletePermissions,
			a.Role,
			func(p hasura.DeletePermission) string {
				return p.Role
			},
		)
		if idx < 0 {
			return "", fmt.Errorf("%w: delete on %s.%s for role %q",
				ErrPermissionNotFound, a.Table.Schema, a.Table.Name, a.Role)
		}

		t.DeletePermissions = append(t.DeletePermissions[:idx], t.DeletePermissions[idx+1:]...)

		return "", nil
	}, nil
}

// PgCreateDeletePermission applies a pg_create_delete_permission.
func (s *Store) PgCreateDeletePermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateDeletePermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// PgDropDeletePermission applies a pg_drop_delete_permission.
func (s *Store) PgDropDeletePermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropDeletePermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
