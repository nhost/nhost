package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opPgTrackFunction            = "pg_track_function"
	opPgUntrackFunction          = "pg_untrack_function"
	opPgSetFunctionCustomization = "pg_set_function_customization"
	opPgCreateFunctionPermission = "pg_create_function_permission"
	opPgDropFunctionPermission   = "pg_drop_function_permission"
)

// ErrFunctionNotTracked is returned when an op targets a function that
// is not in the source's Functions list. Maps to "not-exists".
var ErrFunctionNotTracked = errors.New("function not tracked")

// CodeAlreadyTrackedFn — pg_track_function on an already-tracked function.
// Reuses CodeAlreadyTracked from ops_postgres.go.

func findFunction(db *hasura.DatabaseMetadata, f hasura.FunctionSource) *hasura.FunctionMetadata {
	for i := range db.Functions {
		if db.Functions[i].Function.Schema == f.Schema &&
			db.Functions[i].Function.Name == f.Name {
			return &db.Functions[i]
		}
	}

	return nil
}

// ===== pg_track_function =====

type pgTrackFunctionArgs struct {
	Source        string                       `json:"source"`
	Function      hasura.FunctionSource        `json:"function"`
	Configuration hasura.FunctionConfiguration `json:"configuration,omitzero"`
}

func buildPgTrackFunction(argsJSON []byte) (MutationFn, error) {
	var a pgTrackFunctionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgTrackFunction, err)
	}

	if a.Function.Schema == "" || a.Function.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: function.schema and function.name are required",
			errMissingRequiredField, opPgTrackFunction,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		if findFunction(db, a.Function) != nil {
			return CodeAlreadyTracked, nil
		}

		db.Functions = append(db.Functions, hasura.FunctionMetadata{
			Function:      a.Function,
			Configuration: a.Configuration,
			Permissions:   nil,
			Unknown:       nil,
		})

		return "", nil
	}, nil
}

// PgTrackFunction applies pg_track_function.
func (s *Store) PgTrackFunction(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgTrackFunction(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_untrack_function =====

type pgUntrackFunctionArgs struct {
	Source   string                `json:"source"`
	Function hasura.FunctionSource `json:"function"`
}

func buildPgUntrackFunction(argsJSON []byte) (MutationFn, error) {
	var a pgUntrackFunctionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgUntrackFunction, err)
	}

	if a.Function.Schema == "" || a.Function.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: function.schema and function.name are required",
			errMissingRequiredField, opPgUntrackFunction,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		idx := -1

		for i := range db.Functions {
			if db.Functions[i].Function.Schema == a.Function.Schema &&
				db.Functions[i].Function.Name == a.Function.Name {
				idx = i

				break
			}
		}

		if idx < 0 {
			return "", fmt.Errorf(
				"%w: %s.%s", ErrFunctionNotTracked, a.Function.Schema, a.Function.Name,
			)
		}

		db.Functions = removeAt(db.Functions, idx)

		return "", nil
	}, nil
}

// PgUntrackFunction applies pg_untrack_function.
func (s *Store) PgUntrackFunction(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgUntrackFunction(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_set_function_customization =====

type pgSetFunctionCustomizationArgs struct {
	Source        string                       `json:"source"`
	Function      hasura.FunctionSource        `json:"function"`
	Configuration hasura.FunctionConfiguration `json:"configuration"`
}

func buildPgSetFunctionCustomization(argsJSON []byte) (MutationFn, error) {
	var a pgSetFunctionCustomizationArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgSetFunctionCustomization, err)
	}

	if a.Function.Schema == "" || a.Function.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: function.schema and function.name are required",
			errMissingRequiredField, opPgSetFunctionCustomization,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		fn := findFunction(db, a.Function)
		if fn == nil {
			return "", fmt.Errorf(
				"%w: %s.%s", ErrFunctionNotTracked, a.Function.Schema, a.Function.Name,
			)
		}

		fn.Configuration = a.Configuration

		return "", nil
	}, nil
}

// PgSetFunctionCustomization applies pg_set_function_customization.
func (s *Store) PgSetFunctionCustomization(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgSetFunctionCustomization(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_create_function_permission =====

type pgFunctionPermissionArgs struct {
	Source   string                `json:"source"`
	Function hasura.FunctionSource `json:"function"`
	Role     string                `json:"role"`
}

func buildPgCreateFunctionPermission(argsJSON []byte) (MutationFn, error) {
	var a pgFunctionPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgCreateFunctionPermission, err)
	}

	if a.Function.Schema == "" || a.Function.Name == "" || a.Role == "" {
		return nil, fmt.Errorf(
			"%w: %s: function.schema, function.name and role are required",
			errMissingRequiredField, opPgCreateFunctionPermission,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		fn := findFunction(db, a.Function)
		if fn == nil {
			return "", fmt.Errorf(
				"%w: %s.%s", ErrFunctionNotTracked, a.Function.Schema, a.Function.Name,
			)
		}

		for _, p := range fn.Permissions {
			if p.Role == a.Role {
				return CodeAlreadyExists, nil
			}
		}

		fn.Permissions = append(fn.Permissions, hasura.FunctionPermission{
			Role:    a.Role,
			Unknown: nil,
		})

		return "", nil
	}, nil
}

// PgCreateFunctionPermission applies pg_create_function_permission.
func (s *Store) PgCreateFunctionPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateFunctionPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// ===== pg_drop_function_permission =====

func buildPgDropFunctionPermission(argsJSON []byte) (MutationFn, error) {
	var a pgFunctionPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgDropFunctionPermission, err)
	}

	if a.Function.Schema == "" || a.Function.Name == "" || a.Role == "" {
		return nil, fmt.Errorf(
			"%w: %s: function.schema, function.name and role are required",
			errMissingRequiredField, opPgDropFunctionPermission,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		fn := findFunction(db, a.Function)
		if fn == nil {
			return "", fmt.Errorf(
				"%w: %s.%s", ErrFunctionNotTracked, a.Function.Schema, a.Function.Name,
			)
		}

		idx := indexOfPermission(fn.Permissions, a.Role, func(p hasura.FunctionPermission) string {
			return p.Role
		})
		if idx < 0 {
			return "", fmt.Errorf(
				"%w: %s.%s for role %q",
				ErrPermissionNotFound, a.Function.Schema, a.Function.Name, a.Role,
			)
		}

		fn.Permissions = removeAt(fn.Permissions, idx)

		return "", nil
	}, nil
}

// PgDropFunctionPermission applies pg_drop_function_permission.
func (s *Store) PgDropFunctionPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgDropFunctionPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
