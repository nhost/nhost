package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"reflect"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// IdempotencyCode is the Hasura-compatible error code returned for ops
// that succeed by treating a no-op as success (re-tracking an already
// tracked table, re-creating an existing relationship, etc.). The
// dispatcher emits these as 200 OK with the code in the response body;
// the nhost client treats them as success.
type IdempotencyCode string

const (
	// CodeAlreadyTracked — pg_track_table on an already-tracked table.
	CodeAlreadyTracked IdempotencyCode = "already-tracked"

	// CodeAlreadyExists — pg_create_*_relationship when a relationship
	// of the same name already exists on the table.
	CodeAlreadyExists IdempotencyCode = "already-exists"
)

// MutationFn applies a single metadata mutation to a working clone. It
// returns an IdempotencyCode when the mutation was a no-op (e.g. table
// already tracked) and the snapshot should remain unchanged; otherwise
// returns ("", nil) for a successful mutation or ("", err) for a hard
// failure. Used both by single-op handlers and by ApplyAll for
// bulk_atomic.
type MutationFn func(*hasura.Metadata) (IdempotencyCode, error)

// defaultSource is the source name Hasura assumes when the request omits
// "source". It corresponds to nhost's single configured Postgres source.
const defaultSource = "default"

var (
	// ErrSourceNotFound is returned by a mutation handler when the named
	// source is not present in the metadata snapshot.
	ErrSourceNotFound = errors.New("source not found")

	// ErrTableNotTracked is returned when the target table is not in
	// the named source's Tables list.
	ErrTableNotTracked = errors.New("table not tracked")

	// ErrUnknownMutationOp is returned by BuildMutation when no native
	// handler is registered for the op type. Bulk dispatchers map this
	// to a per-child "not-supported" entry.
	ErrUnknownMutationOp = errors.New("unknown mutation op")
)

// errMissingRequiredField is the shared sentinel wrapped by every
// buildXxx parser when a request omits a field it requires (table
// schema/name, role, function name, …). It is detected before any
// mutation runs and is deliberately distinct from the not-exists /
// conflict sentinels so classifyMutationError leaves it in the
// "validation-failed" catch-all. Wrap it with the per-op context:
// fmt.Errorf("%w: pg_track_table: table.schema and table.name are required", errMissingRequiredField).
var errMissingRequiredField = errors.New("missing required field")

func defaultIfEmpty(source string) string {
	if source == "" {
		return defaultSource
	}

	return source
}

func findDatabase(h *hasura.Metadata, name string) *hasura.DatabaseMetadata {
	for i := range h.Databases {
		if h.Databases[i].Name == name {
			return &h.Databases[i]
		}
	}

	return nil
}

func findTable(db *hasura.DatabaseMetadata, t hasura.TableSource) *hasura.TableMetadata {
	for i := range db.Tables {
		if db.Tables[i].Table.Schema == t.Schema && db.Tables[i].Table.Name == t.Name {
			return &db.Tables[i]
		}
	}

	return nil
}

// BuildMutation returns the MutationFn for a known op type, or
// ErrUnknownMutationOp. The bulk dispatcher uses this to compose
// children of a bulk_atomic; single-op handlers below also funnel
// through it so the type→handler mapping lives in one place.
//
//nolint:cyclop,funlen // flat op-dispatch table; one arm per metadata op.
func BuildMutation(opType string, argsJSON []byte) (MutationFn, error) {
	switch opType {
	case opPgTrackTable:
		return buildPgTrackTable(argsJSON)
	case opPgSetTableCustomization:
		return buildPgSetTableCustomization(argsJSON)
	case opPgCreateObjectRelationship:
		return buildPgCreateObjectRelationship(argsJSON)
	case opPgCreateArrayRelationship:
		return buildPgCreateArrayRelationship(argsJSON)
	case opPgCreateSelectPermission:
		return buildPgCreateSelectPermission(argsJSON)
	case opPgDropSelectPermission:
		return buildPgDropSelectPermission(argsJSON)
	case opPgCreateInsertPermission:
		return buildPgCreateInsertPermission(argsJSON)
	case opPgDropInsertPermission:
		return buildPgDropInsertPermission(argsJSON)
	case opPgCreateUpdatePermission:
		return buildPgCreateUpdatePermission(argsJSON)
	case opPgDropUpdatePermission:
		return buildPgDropUpdatePermission(argsJSON)
	case opPgCreateDeletePermission:
		return buildPgCreateDeletePermission(argsJSON)
	case opPgDropDeletePermission:
		return buildPgDropDeletePermission(argsJSON)
	case opPgUntrackTable:
		// BuildMutation has no DB handle, so this arm returns a metadata-only
		// cascade (deps == nil) for direct callers that lack one. The real call
		// paths do not rely on it: bulk / bulk_keep_going children are
		// special-cased in planBulkChild, which resolves the FK graph / function
		// return types and passes real deps for full DB-backed cascade parity,
		// and bulk_atomic rejects pg_untrack_table before it reaches here. The
		// single-op path (Store.PgUntrackTable) likewise supplies deps.
		return buildPgUntrackTable(argsJSON, nil)
	case opPgSetTableIsEnum:
		return buildPgSetTableIsEnum(argsJSON)
	case opPgDropRelationship:
		return buildPgDropRelationship(argsJSON)
	case opPgRenameRelationship:
		return buildPgRenameRelationship(argsJSON)
	case opPgTrackFunction:
		return buildPgTrackFunction(argsJSON)
	case opPgUntrackFunction:
		return buildPgUntrackFunction(argsJSON)
	case opPgSetFunctionCustomization:
		return buildPgSetFunctionCustomization(argsJSON)
	case opPgCreateFunctionPermission:
		return buildPgCreateFunctionPermission(argsJSON)
	case opPgDropFunctionPermission:
		return buildPgDropFunctionPermission(argsJSON)
	case opPgCreateEventTrigger:
		return buildPgCreateEventTrigger(argsJSON)
	case opPgDeleteEventTrigger:
		return buildPgDeleteEventTrigger(argsJSON)
	case opPgCreateRemoteRelationship:
		return buildPgCreateRemoteRelationship(argsJSON)
	case opPgDeleteRemoteRelationship:
		return buildPgDeleteRemoteRelationship(argsJSON)
	case opAddRemoteSchema:
		return buildAddRemoteSchema(argsJSON)
	case opRemoveRemoteSchema:
		return buildRemoveRemoteSchema(argsJSON)
	case opUpdateRemoteSchema:
		return buildUpdateRemoteSchema(argsJSON)
	case opAddRemoteSchemaPermissions:
		return buildAddRemoteSchemaPermissions(argsJSON)
	case opDropRemoteSchemaPermissions:
		return buildDropRemoteSchemaPermissions(argsJSON)
	}

	if fn, err := buildRemoteSchemaMutation(opType, argsJSON); !errors.Is(err, ErrUnknownMutationOp) {
		return fn, err
	}

	return buildActionMutation(opType, argsJSON)
}

// buildRemoteSchemaMutation returns the MutationFn for the remote-schema
// mutation ops, or ErrUnknownMutationOp. Split out of BuildMutation so each
// op-dispatch table stays under the cyclomatic-complexity limit; the two
// together enumerate exactly the ops guarded by TestMutationOpDispatchParity.
func buildRemoteSchemaMutation(opType string, argsJSON []byte) (MutationFn, error) {
	switch opType {
	case opAddRemoteSchema:
		return buildAddRemoteSchema(argsJSON)
	case opRemoveRemoteSchema:
		return buildRemoveRemoteSchema(argsJSON)
	case opUpdateRemoteSchema:
		return buildUpdateRemoteSchema(argsJSON)
	case opAddRemoteSchemaPermissions:
		return buildAddRemoteSchemaPermissions(argsJSON)
	case opDropRemoteSchemaPermissions:
		return buildDropRemoteSchemaPermissions(argsJSON)
	case opCreateRemoteSchemaRemoteRelationship:
		return buildCreateRemoteSchemaRemoteRelationship(argsJSON)
	case opUpdateRemoteSchemaRemoteRelationship:
		return buildUpdateRemoteSchemaRemoteRelationship(argsJSON)
	case opDeleteRemoteSchemaRemoteRelationship:
		return buildDeleteRemoteSchemaRemoteRelationship(argsJSON)
	}

	return nil, fmt.Errorf("%w: %q", ErrUnknownMutationOp, opType)
}

const (
	opPgTrackTable               = "pg_track_table"
	opPgSetTableCustomization    = "pg_set_table_customization"
	opPgCreateObjectRelationship = "pg_create_object_relationship"
	opPgCreateArrayRelationship  = "pg_create_array_relationship"
)

// applyOne runs a single MutationFn through Store.Apply and converts
// an idempotency outcome into the (rv, code, err) triple the dispatcher
// expects. On idempotent no-op, rv is the unchanged current version.
func (s *Store) applyOne(
	ctx context.Context, fn MutationFn,
) (int64, IdempotencyCode, error) {
	var code IdempotencyCode

	rv, err := s.Apply(ctx, func(h *hasura.Metadata) error {
		c, mErr := fn(h)
		if mErr != nil {
			return mErr
		}

		if c != "" {
			code = c

			return errIdempotentNoOp
		}

		return nil
	})

	if errors.Is(err, errIdempotentNoOp) {
		return s.ResourceVersion(), code, nil
	}

	if err != nil {
		return 0, "", err
	}

	return rv, "", nil
}

// errIdempotentNoOp is the sentinel returned from inside Apply's mutate
// callback to signal "no actual change happened, abort the write but
// don't surface as an error to the caller". applyOne and ApplyAll
// translate it into an IdempotencyCode response slot.
var errIdempotentNoOp = errors.New("idempotent no-op")

type pgTrackTableArgs struct {
	Source              string                      `json:"source"`
	Table               hasura.TableSource          `json:"table"`
	IsEnum              bool                        `json:"is_enum,omitempty"`
	Configuration       hasura.TableConfiguration   `json:"configuration"`
	ObjectRelationships []hasura.ObjectRelationship `json:"object_relationships,omitempty"`
	ArrayRelationships  []hasura.ArrayRelationship  `json:"array_relationships,omitempty"`
}

// validateInlineRelationshipNames rejects a pg_track_table payload whose inline
// object/array relationship lists declare the same name more than once: a
// duplicate within either list, or a name present in both. This mirrors the
// reject-on-conflict contract of the dedicated pg_create_*_relationship ops
// (which return ErrRelationshipExists) rather than silently deduplicating,
// since silent dedup would diverge from those ops and hide a malformed payload.
func validateInlineRelationshipNames(
	objs []hasura.ObjectRelationship, arrs []hasura.ArrayRelationship,
) error {
	seen := make(map[string]struct{}, len(objs)+len(arrs))

	for _, r := range objs {
		if _, dup := seen[r.Name]; dup {
			return fmt.Errorf(
				"%w: inline relationship %q declared more than once",
				ErrRelationshipExists, r.Name,
			)
		}

		seen[r.Name] = struct{}{}
	}

	for _, r := range arrs {
		if _, dup := seen[r.Name]; dup {
			return fmt.Errorf(
				"%w: inline relationship %q declared more than once",
				ErrRelationshipExists, r.Name,
			)
		}

		seen[r.Name] = struct{}{}
	}

	return nil
}

func buildPgTrackTable(argsJSON []byte) (MutationFn, error) {
	var a pgTrackTableArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing pg_track_table args: %w", err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" {
		return nil, fmt.Errorf(
			"%w: pg_track_table: table.schema and table.name are required",
			errMissingRequiredField,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		if findTable(db, a.Table) != nil {
			return CodeAlreadyTracked, nil
		}

		// The dedicated pg_create_*_relationship ops reject duplicate names via
		// ErrRelationshipExists. track_table's inline lists must uphold the same
		// contract, otherwise a payload with colliding names persists
		// self-inconsistent metadata that fails schema validation downstream.
		if err := validateInlineRelationshipNames(
			a.ObjectRelationships, a.ArrayRelationships,
		); err != nil {
			return "", err
		}

		db.Tables = append(db.Tables, hasura.TableMetadata{
			Table:               a.Table,
			IsEnum:              a.IsEnum,
			Configuration:       a.Configuration,
			ObjectRelationships: a.ObjectRelationships,
			ArrayRelationships:  a.ArrayRelationships,
			RemoteRelationships: nil,
			SelectPermissions:   nil,
			InsertPermissions:   nil,
			UpdatePermissions:   nil,
			DeletePermissions:   nil,
			EventTriggers:       nil,
			Unknown:             nil,
		})

		return "", nil
	}, nil
}

// PgTrackTable applies a pg_track_table mutation. Returns
// CodeAlreadyTracked if the table is already tracked in the named
// source; rv reflects the current version in that case.
func (s *Store) PgTrackTable(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgTrackTable(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type pgSetTableCustomizationArgs struct {
	Source        string                    `json:"source"`
	Table         hasura.TableSource        `json:"table"`
	Configuration hasura.TableConfiguration `json:"configuration"`
}

func buildPgSetTableCustomization(argsJSON []byte) (MutationFn, error) {
	var a pgSetTableCustomizationArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing pg_set_table_customization args: %w", err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" {
		return nil, fmt.Errorf(
			"%w: pg_set_table_customization: table.schema and table.name are required",
			errMissingRequiredField,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		t := findTable(db, a.Table)
		if t == nil {
			return "", fmt.Errorf("%w: %s.%s", ErrTableNotTracked, a.Table.Schema, a.Table.Name)
		}

		t.Configuration = a.Configuration

		return "", nil
	}, nil
}

// PgSetTableCustomization applies a pg_set_table_customization mutation.
func (s *Store) PgSetTableCustomization(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgSetTableCustomization(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type pgCreateObjectRelationshipArgs struct {
	Source  string                   `json:"source"`
	Table   hasura.TableSource       `json:"table"`
	Name    string                   `json:"name"`
	Using   hasura.RelationshipUsing `json:"using"`
	Comment string                   `json:"comment,omitempty"`
}

// relationshipReapplyCode decides the outcome of a pg_create_*_relationship
// whose name already matches an existing object/array relationship on the same
// table. A remote-derived match (a remote relationship lowered into a same-named
// object/array entry by convertRemoteRelationships) is always treated as an
// idempotent CodeAlreadyExists: its lowered definition deliberately diverges
// from the wire args, so comparing it would spuriously report a conflict. For a
// genuine object/array relationship, an identical definition (Using + Comment)
// is the idempotent re-apply Hasura answers with already-exists at 200; a
// changed definition is rejected with ErrRelationshipExists so the new
// definition is not silently discarded (Hasura's reject-on-conflict, 400).
func relationshipReapplyCode(
	t *hasura.TableMetadata,
	name string,
	existingUsing hasura.RelationshipUsing,
	existingComment string,
	requestedUsing hasura.RelationshipUsing,
	requestedComment string,
) (IdempotencyCode, error) {
	if relationshipIsRemoteDerived(t, name) {
		return CodeAlreadyExists, nil
	}

	if reflect.DeepEqual(existingUsing, requestedUsing) &&
		existingComment == requestedComment {
		return CodeAlreadyExists, nil
	}

	return "", fmt.Errorf(
		"%w: relationship %q already exists with a different definition",
		ErrRelationshipExists, name,
	)
}

//nolint:dupl // intentional mirror of buildPgCreateArrayRelationship; one per relationship kind.
func buildPgCreateObjectRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgCreateObjectRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing pg_create_object_relationship args: %w", err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: pg_create_object_relationship: table.schema, table.name and name are required",
			errMissingRequiredField,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		t := findTable(db, a.Table)
		if t == nil {
			return "", fmt.Errorf("%w: %s.%s", ErrTableNotTracked, a.Table.Schema, a.Table.Name)
		}

		for _, r := range t.ObjectRelationships {
			if r.Name == a.Name {
				return relationshipReapplyCode(t, a.Name, r.Using, r.Comment, a.Using, a.Comment)
			}
		}

		if relationshipNameExists(t, a.Name) || remoteRelationshipNameExists(t, a.Name) {
			return "", fmt.Errorf(
				"%w: %q on %s.%s", ErrRelationshipExists, a.Name, a.Table.Schema, a.Table.Name,
			)
		}

		t.ObjectRelationships = append(t.ObjectRelationships, hasura.ObjectRelationship{
			Name:    a.Name,
			Using:   a.Using,
			Comment: a.Comment,
			Unknown: nil,
		})

		return "", nil
	}, nil
}

// PgCreateObjectRelationship applies a pg_create_object_relationship.
func (s *Store) PgCreateObjectRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateObjectRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type pgCreateArrayRelationshipArgs struct {
	Source  string                   `json:"source"`
	Table   hasura.TableSource       `json:"table"`
	Name    string                   `json:"name"`
	Using   hasura.RelationshipUsing `json:"using"`
	Comment string                   `json:"comment,omitempty"`
}

//nolint:dupl // intentional mirror of buildPgCreateObjectRelationship; one per relationship kind.
func buildPgCreateArrayRelationship(argsJSON []byte) (MutationFn, error) {
	var a pgCreateArrayRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing pg_create_array_relationship args: %w", err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" || a.Name == "" {
		return nil, fmt.Errorf(
			"%w: pg_create_array_relationship: table.schema, table.name and name are required",
			errMissingRequiredField,
		)
	}

	source := defaultIfEmpty(a.Source)

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		db := findDatabase(h, source)
		if db == nil {
			return "", fmt.Errorf("%w: %q", ErrSourceNotFound, source)
		}

		t := findTable(db, a.Table)
		if t == nil {
			return "", fmt.Errorf("%w: %s.%s", ErrTableNotTracked, a.Table.Schema, a.Table.Name)
		}

		for _, r := range t.ArrayRelationships {
			if r.Name == a.Name {
				return relationshipReapplyCode(t, a.Name, r.Using, r.Comment, a.Using, a.Comment)
			}
		}

		if relationshipNameExists(t, a.Name) || remoteRelationshipNameExists(t, a.Name) {
			return "", fmt.Errorf(
				"%w: %q on %s.%s", ErrRelationshipExists, a.Name, a.Table.Schema, a.Table.Name,
			)
		}

		t.ArrayRelationships = append(t.ArrayRelationships, hasura.ArrayRelationship{
			Name:    a.Name,
			Using:   a.Using,
			Comment: a.Comment,
			Unknown: nil,
		})

		return "", nil
	}, nil
}

// PgCreateArrayRelationship applies a pg_create_array_relationship.
func (s *Store) PgCreateArrayRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildPgCreateArrayRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}
