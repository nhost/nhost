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

func buildPgUntrackTable(argsJSON []byte) (MutationFn, error) {
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

		db.Tables = removeAt(db.Tables, idx)

		return "", nil
	}, nil
}

// tableHasDependents reports whether the table has any permissions or
// relationships configured. Used by pg_untrack_table to enforce the
// cascade flag.
func tableHasDependents(t hasura.TableMetadata) bool {
	return len(t.SelectPermissions) > 0 ||
		len(t.InsertPermissions) > 0 ||
		len(t.UpdatePermissions) > 0 ||
		len(t.DeletePermissions) > 0 ||
		len(t.ObjectRelationships) > 0 ||
		len(t.ArrayRelationships) > 0
}

// PgUntrackTable applies pg_untrack_table.
func (s *Store) PgUntrackTable(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgUntrackTable(argsJSON)
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

// renameRelationship renames the object/array relationship `name` to `newName`
// on table t. A self-rename is an idempotent no-op, but only once the
// relationship is confirmed to exist (renaming a missing relationship reports
// not-exists, matching Hasura). Renaming onto a name already used by a
// different relationship is rejected with ErrRelationshipExists, since it would
// create two relationships sharing one GraphQL field name.
func renameRelationship(
	t *hasura.TableMetadata, table hasura.TableSource, name, newName string,
) (IdempotencyCode, error) {
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

	if relationshipNameExists(t, newName) {
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
