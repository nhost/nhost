package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opPgUntrackTable       = "pg_untrack_table"
	opPgSetTableIsEnum     = "pg_set_table_is_enum"
	opPgDropRelationship   = "pg_drop_relationship"
	opPgRenameRelationship = "pg_rename_relationship"
)

// ErrRelationshipNotFound is returned by pg_drop_relationship /
// pg_rename_relationship when no relationship with the given name
// exists on the table. Maps to Hasura code "not-exists".
var ErrRelationshipNotFound = errors.New("relationship not found")

// ErrRelationshipExists is returned by pg_rename_relationship when the
// requested new_name is already taken by a different relationship on the
// same table. Renaming over it would create two relationships sharing one
// GraphQL field name (which Hasura also rejects). Maps to Hasura code
// "already-exists".
var ErrRelationshipExists = errors.New("relationship already exists")

// ErrTableHasDependents is returned by pg_untrack_table when the table
// still has permissions or relationships and cascade is not set. Maps
// to Hasura code "dependency-error" via classifyMutationError.
var ErrTableHasDependents = errors.New(
	"table has dependent permissions or relationships; pass cascade=true to drop them",
)

// ErrTableAlreadyUntracked is returned by pg_untrack_table when the target
// table is not tracked. Maps to Hasura code "already-untracked" (Hasura treats
// untracking an untracked table as an already-untracked condition, not a
// generic not-exists), so a drop-in export must match.
var ErrTableAlreadyUntracked = errors.New("table already untracked")

// removeAt returns s with element i removed. Caller has already
// bounds-checked i.
func removeAt[T any](s []T, i int) []T {
	return append(s[:i], s[i+1:]...)
}

// ===== pg_untrack_table =====

type pgUntrackTableArgs struct {
	Source  string             `json:"source"`
	Table   hasura.TableSource `json:"table"`
	Cascade bool               `json:"cascade,omitempty"`
}

func buildPgUntrackTable(argsJSON []byte, deps *untrackDeps) (MutationFn, error) {
	var a pgUntrackTableArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgUntrackTable, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema and table.name are required",
			errMissingRequiredField, opPgUntrackTable,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		idx := -1

		for i, t := range db.Tables {
			if t.Table.Schema == a.Table.Schema && t.Table.Name == a.Table.Name {
				idx = i

				break
			}
		}

		if idx < 0 {
			return "", fmt.Errorf(
				"%w: %s.%s", ErrTableAlreadyUntracked, a.Table.Schema, a.Table.Name,
			)
		}

		if !a.Cascade && tableHasDependents(db.Tables[idx]) {
			return "", ErrTableHasDependents
		}

		target := db.Tables[idx].Table
		db.Tables = removeAt(db.Tables, idx)

		// Removing the table drops its own dependents. Hasura's cascade also
		// drops the transitive reverse dependents across the whole metadata:
		// relationships that point at the table, functions whose return type is
		// the table, and permissions whose row filter references it. See
		// cascadeUntrack.
		if a.Cascade {
			cascadeUntrack(h, source, target, deps)
		}

		return "", nil
	}, nil
}

// tableHasDependents reports whether the table has any permissions,
// relationships, event triggers, or remote relationships configured. Used by
// pg_untrack_table to enforce the cascade flag: dropping the table without
// cascade must fail rather than silently discard these dependents.
func tableHasDependents(t hasura.TableMetadata) bool {
	return len(t.SelectPermissions) > 0 ||
		len(t.InsertPermissions) > 0 ||
		len(t.UpdatePermissions) > 0 ||
		len(t.DeletePermissions) > 0 ||
		len(t.ObjectRelationships) > 0 ||
		len(t.ArrayRelationships) > 0 ||
		len(t.EventTriggers) > 0 ||
		len(t.RemoteRelationships) > 0
}

// PgUntrackTable applies pg_untrack_table.
//
// For a cascade on a database-backed Store, it first introspects the database
// facts the metadata alone cannot supply — the foreign-key graph (to resolve
// bare foreign_key_constraint_on relationships to their target table) and the
// return types of functions — so cascadeUntrack can reproduce Hasura's full
// transitive drop. The introspection runs before Apply (lock-free); the
// resulting facts are immutable DB properties, so computing them outside the
// store mutex is safe.
func (s *Store) PgUntrackTable(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	deps, err := s.loadUntrackDeps(ctx, argsJSON)
	if err != nil {
		return 0, "", err
	}

	fn, err := buildPgUntrackTable(argsJSON, deps)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_set_table_is_enum =====

type pgSetTableIsEnumArgs struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
	IsEnum bool               `json:"is_enum"`
}

func buildPgSetTableIsEnum(argsJSON []byte) (MutationFn, error) {
	var a pgSetTableIsEnumArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgSetTableIsEnum, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema and table.name are required",
			errMissingRequiredField, opPgSetTableIsEnum,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		t.IsEnum = a.IsEnum

		return "", nil
	}, nil
}

// PgSetTableIsEnum applies pg_set_table_is_enum.
func (s *Store) PgSetTableIsEnum(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgSetTableIsEnum(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_drop_relationship =====

type pgDropRelationshipArgs struct {
	Source       string             `json:"source"`
	Table        hasura.TableSource `json:"table"`
	Relationship string             `json:"relationship"`
}

func buildPgDropRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgDropRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropRelationship, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Relationship == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name and relationship are required",
			errMissingRequiredField, opPgDropRelationship,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		// On load, every remote relationship is lowered into a same-named
		// object/array relationship. Refuse to operate on that lowered duplicate:
		// removing it leaves t.RemoteRelationships untouched, so the relationship
		// re-lowers on the next reload and the drop is a silent no-op. Remote
		// relationships are deleted via pg_delete_remote_relationship.
		if relationshipIsRemoteDerived(t, a.Relationship) {
			return "", fmt.Errorf(
				"%w: %q is a remote relationship; use pg_delete_remote_relationship "+
					"(pg_rename_relationship/pg_drop_relationship operate only on "+
					"object/array relationships)",
				ErrRelationshipNotFound, a.Relationship,
			)
		}

		for i, r := range t.ObjectRelationships {
			if r.Name == a.Relationship {
				t.ObjectRelationships = removeAt(t.ObjectRelationships, i)

				return "", nil
			}
		}

		for i, r := range t.ArrayRelationships {
			if r.Name == a.Relationship {
				t.ArrayRelationships = removeAt(t.ArrayRelationships, i)

				return "", nil
			}
		}

		return "", fmt.Errorf(
			"%w: %q on %s.%s",
			ErrRelationshipNotFound, a.Relationship, a.Table.Schema, a.Table.Name,
		)
	}, nil
}

// PgDropRelationship applies pg_drop_relationship.
func (s *Store) PgDropRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_rename_relationship =====

type pgRenameRelationshipArgs struct {
	Source  string             `json:"source"`
	Table   hasura.TableSource `json:"table"`
	Name    string             `json:"name"`
	NewName string             `json:"new_name"`
}

func buildPgRenameRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgRenameRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgRenameRelationship, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" || a.NewName == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema, table.name, name, and new_name are required",
			errMissingRequiredField, opPgRenameRelationship,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		t, err := resolveTable(h, source, a.Table)
		if err != nil {
			return "", err
		}

		return renameRelationship(t, a.Table, a.Name, a.NewName)
	}, nil
}

// relationshipNameExists reports whether the table already has an object or
// array relationship named name.
func relationshipNameExists(t *hasura.TableMetadata, name string) bool {
	for _, r := range t.ObjectRelationships {
		if r.Name == name {
			return true
		}
	}

	for _, r := range t.ArrayRelationships {
		if r.Name == name {
			return true
		}
	}

	return false
}

// remoteRelationshipNameExists reports whether the table already has a remote
// relationship named name.
func remoteRelationshipNameExists(t *hasura.TableMetadata, name string) bool {
	for _, r := range t.RemoteRelationships {
		if r.Name == name {
			return true
		}
	}

	return false
}

// relationshipIsRemoteDerived reports whether name belongs to a remote
// relationship. On load, FromJSON lowers each remote relationship into a
// same-named object/array relationship, so the object/array lists scanned by
// pg_drop_relationship / pg_rename_relationship contain a duplicate the export
// strips by matching RemoteRelationships names. Those ops must skip the lowered
// duplicate to avoid corrupting the export, so they consult this guard first.
func relationshipIsRemoteDerived(t *hasura.TableMetadata, name string) bool {
	return remoteRelationshipNameExists(t, name)
}

// removeLoweredRelationship drops any object/array relationship named name from
// t. On load, FromJSON lowers each remote relationship into a same-named
// object/array relationship, and export strips that duplicate only while the
// name still appears in RemoteRelationships. A mutator that removes the entry
// from RemoteRelationships must therefore also remove the lowered duplicate, or
// the export-time strip no longer recognizes it as derived and persists it as a
// phantom object/array relationship. The name lowers to exactly one of the two
// lists, so this removes at most one entry.
func removeLoweredRelationship(t *hasura.TableMetadata, name string) {
	for i, r := range t.ObjectRelationships {
		if r.Name == name {
			t.ObjectRelationships = removeAt(t.ObjectRelationships, i)

			return
		}
	}

	for i, r := range t.ArrayRelationships {
		if r.Name == name {
			t.ArrayRelationships = removeAt(t.ArrayRelationships, i)

			return
		}
	}
}

// renameRelationship renames the object/array relationship `name` to `newName`
// on table t. A self-rename is an idempotent no-op, but only once the
// relationship is confirmed to exist (renaming a missing relationship reports
// not-exists, matching Hasura). Renaming onto a name already used by a
// different relationship is rejected with ErrRelationshipExists, since it would
// create two relationships sharing one GraphQL field name.
func renameRelationship(
	t *hasura.TableMetadata, table hasura.TableSource, name, newName string,
) (IdempotencyCode, error) {
	// On load, every remote relationship is lowered into a same-named
	// object/array relationship. Renaming that lowered duplicate leaves the
	// original in t.RemoteRelationships untouched: the renamed duplicate then
	// escapes the export-time strip filter (which matches by RemoteRelationships
	// name) and leaks into the export, while the original re-lowers on reload —
	// producing a duplicate, non-round-tripping relationship. Refuse it here;
	// remote relationships are managed via pg_create/pg_delete_remote_relationship.
	if relationshipIsRemoteDerived(t, name) {
		return "", fmt.Errorf(
			"%w: %q is a remote relationship; use pg_delete_remote_relationship "+
				"(pg_rename_relationship/pg_drop_relationship operate only on "+
				"object/array relationships)",
			ErrRelationshipNotFound, name,
		)
	}

	objIdx := -1

	for i := range t.ObjectRelationships {
		if t.ObjectRelationships[i].Name == name {
			objIdx = i

			break
		}
	}

	arrIdx := -1

	if objIdx < 0 {
		for i := range t.ArrayRelationships {
			if t.ArrayRelationships[i].Name == name {
				arrIdx = i

				break
			}
		}
	}

	if objIdx < 0 && arrIdx < 0 {
		return "", fmt.Errorf(
			"%w: %q on %s.%s", ErrRelationshipNotFound, name, table.Schema, table.Name,
		)
	}

	if name == newName {
		return CodeAlreadyExists, nil
	}

	if relationshipNameExists(t, newName) || remoteRelationshipNameExists(t, newName) {
		return "", fmt.Errorf(
			"%w: %q on %s.%s", ErrRelationshipExists, newName, table.Schema, table.Name,
		)
	}

	if objIdx >= 0 {
		t.ObjectRelationships[objIdx].Name = newName
	} else {
		t.ArrayRelationships[arrIdx].Name = newName
	}

	return "", nil
}

// PgRenameRelationship applies pg_rename_relationship.
func (s *Store) PgRenameRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgRenameRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
