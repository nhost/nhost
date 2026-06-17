package source

import (
	"context"
	stdjson "encoding/json"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opAddRemoteSchema             = "add_remote_schema"
	opRemoveRemoteSchema          = "remove_remote_schema"
	opUpdateRemoteSchema          = "update_remote_schema"
	opAddRemoteSchemaPermissions  = "add_remote_schema_permissions"
	opDropRemoteSchemaPermissions = "drop_remote_schema_permissions"
	opIntrospectRemoteSchema      = "introspect_remote_schema"
	opReloadRemoteSchema          = "reload_remote_schema"

	opCreateRemoteSchemaRemoteRelationship = "create_remote_schema_remote_relationship"
	opUpdateRemoteSchemaRemoteRelationship = "update_remote_schema_remote_relationship"
	opDeleteRemoteSchemaRemoteRelationship = "delete_remote_schema_remote_relationship"
)

// ErrRemoteSchemaNotFound is returned by remove/update/permission ops when no
// remote schema with the given name is registered. The dispatcher maps it to
// the Hasura error code "not-exists".
var ErrRemoteSchemaNotFound = errors.New("remote schema not found")

// ErrRemoteSchemaPermissionNotFound is returned by drop_remote_schema_permissions
// when the named role has no permission on the remote schema. Mapped to
// "not-exists".
var ErrRemoteSchemaPermissionNotFound = errors.New("remote schema permission not found")

// ErrRemoteSchemaIntrospectionUnavailable is returned by introspect/reload ops
// when the Store was constructed without an introspector (file-source or a
// test that did not wire one). Mapped to "not-supported".
var ErrRemoteSchemaIntrospectionUnavailable = errors.New(
	"remote schema introspection is not available on this store",
)

// findRemoteSchema returns a pointer to the named remote schema entry in h, or
// nil when it is not registered.
func findRemoteSchema(h *hasura.Metadata, name string) *hasura.RemoteSchemaMetadata {
	for i := range h.RemoteSchemas {
		if h.RemoteSchemas[i].Name == name {
			return &h.RemoteSchemas[i]
		}
	}

	return nil
}

// sliceOf returns the elements addressed by a generated optional array (*[]T),
// or nil when unset. The api wire types model arrays as pointers; the mutation
// engine works with plain slices and re-points the field after mutating.
func sliceOf[T any](p *[]T) []T {
	if p == nil {
		return nil
	}

	return *p
}

// parseRemoteSchemaInfo decodes the {name, definition, comment, permissions?,
// remote_relationships?} envelope shared by add_remote_schema and
// update_remote_schema directly into the wire model that is stored verbatim.
// It enforces the two invariants Hasura also requires: a name, and exactly one
// of url / url_from_env.
func parseRemoteSchemaInfo(argsJSON []byte, op string) (hasura.RemoteSchemaMetadata, error) {
	var rs hasura.RemoteSchemaMetadata
	if err := json.Unmarshal(argsJSON, &rs); err != nil {
		return rs, fmt.Errorf("parsing %s args: %w", op, err)
	}

	if rs.Name == "" {
		return rs, fmt.Errorf("%w: %s: name is required", errMissingRequiredField, op)
	}

	hasURL := rs.Definition.Url != nil && *rs.Definition.Url != ""
	hasURLFromEnv := rs.Definition.UrlFromEnv != nil && *rs.Definition.UrlFromEnv != ""
	if hasURL == hasURLFromEnv {
		return rs, fmt.Errorf(
			"%w: %s: definition must set exactly one of url or url_from_env",
			errMissingRequiredField, op,
		)
	}

	return rs, nil
}

// validateRemoteSchema runs the synchronous validator (URL/header resolution,
// permission-SDL parsing, admin introspection) against the prospective remote
// schema. It is the same path the controller uses to build the connector, so a
// success here guarantees the post-mutation state rebuild also succeeds. A nil
// validator (file-source / unit tests that opt out) skips the check.
func (s *Store) validateRemoteSchema(ctx context.Context, rs hasura.RemoteSchemaMetadata) error {
	if s.rsValidator == nil {
		return nil
	}

	native := metadata.ConvertRemoteSchema(rs)
	if err := s.rsValidator(ctx, &native); err != nil {
		return fmt.Errorf("validating remote schema %q: %w", rs.Name, err)
	}

	return nil
}

// remoteSchemaExists reports whether a remote schema with the given name is
// registered in the current snapshot.
func (s *Store) remoteSchemaExists(name string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.hasura != nil && findRemoteSchema(s.hasura, name) != nil
}

func buildAddRemoteSchema(argsJSON []byte) (MutationFn, error) {
	rs, err := parseRemoteSchemaInfo(argsJSON, opAddRemoteSchema)
	if err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		if findRemoteSchema(h, rs.Name) != nil {
			return CodeAlreadyExists, nil
		}

		h.RemoteSchemas = append(h.RemoteSchemas, rs)

		return "", nil
	}, nil
}

// AddRemoteSchema applies an add_remote_schema mutation. It mirrors Hasura's
// add-time behaviour: a name collision short-circuits to already-exists without
// touching the network, otherwise the upstream is introspected synchronously
// (validateRemoteSchema) before the entry is persisted.
func (s *Store) AddRemoteSchema(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	rs, err := parseRemoteSchemaInfo(argsJSON, opAddRemoteSchema)
	if err != nil {
		return 0, "", err
	}

	if s.remoteSchemaExists(rs.Name) {
		return s.ResourceVersion(), CodeAlreadyExists, nil
	}

	if err := s.validateRemoteSchema(ctx, rs); err != nil {
		return 0, "", err
	}

	fn, err := buildAddRemoteSchema(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type removeRemoteSchemaArgs struct {
	Name string `json:"name"`
}

func buildRemoveRemoteSchema(argsJSON []byte) (MutationFn, error) {
	var a removeRemoteSchemaArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opRemoveRemoteSchema, err)
	}

	if a.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: name is required",
			errMissingRequiredField,
			opRemoveRemoteSchema,
		)
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		for i := range h.RemoteSchemas {
			if h.RemoteSchemas[i].Name == a.Name {
				h.RemoteSchemas = append(h.RemoteSchemas[:i], h.RemoteSchemas[i+1:]...)

				return "", nil
			}
		}

		return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, a.Name)
	}, nil
}

// RemoveRemoteSchema applies a remove_remote_schema mutation. No introspection
// is needed to remove an entry.
func (s *Store) RemoveRemoteSchema(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildRemoveRemoteSchema(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// buildUpdateRemoteSchema replaces the matched entry's definition and comment in
// place. It mirrors Hasura's verified update_remote_schema semantics: existing
// permissions are preserved (unless the args supply replacements), but remote
// relationships are always dropped. Hasura discards a remote schema's
// remote_relationships on update_remote_schema regardless of the new definition
// (confirmed against the live engine — see the
// update_remote_schema_drops_remote_relationships parity case); they are
// re-added separately via *_remote_schema_remote_relationship ops.
func buildUpdateRemoteSchema(argsJSON []byte) (MutationFn, error) {
	rs, err := parseRemoteSchemaInfo(argsJSON, opUpdateRemoteSchema)
	if err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		existing := findRemoteSchema(h, rs.Name)
		if existing == nil {
			return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, rs.Name)
		}

		existing.Definition = rs.Definition
		existing.Comment = rs.Comment

		if rs.Permissions != nil && len(*rs.Permissions) > 0 {
			existing.Permissions = rs.Permissions
		}

		existing.RemoteRelationships = nil

		return "", nil
	}, nil
}

// UpdateRemoteSchema applies an update_remote_schema mutation, re-introspecting
// the (possibly changed) upstream before persisting.
func (s *Store) UpdateRemoteSchema(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	rs, err := parseRemoteSchemaInfo(argsJSON, opUpdateRemoteSchema)
	if err != nil {
		return 0, "", err
	}

	if !s.remoteSchemaExists(rs.Name) {
		return 0, "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, rs.Name)
	}

	if err := s.validateRemoteSchema(ctx, s.mergedRemoteSchemaForUpdate(rs)); err != nil {
		return 0, "", err
	}

	fn, err := buildUpdateRemoteSchema(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// mergedRemoteSchemaForUpdate returns the entry as it will look after the update
// mutation, so the validator introspects/parses the final state: new definition,
// preserved-or-replaced permissions, and dropped remote relationships (matching
// buildUpdateRemoteSchema). Falls back to the args alone when the entry is absent
// (the caller has already rejected that case).
func (s *Store) mergedRemoteSchemaForUpdate(
	rs hasura.RemoteSchemaMetadata,
) hasura.RemoteSchemaMetadata {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing := findRemoteSchema(s.hasura, rs.Name)
	if existing == nil {
		return rs
	}

	merged := *existing
	merged.Definition = rs.Definition
	merged.Comment = rs.Comment

	if rs.Permissions != nil && len(*rs.Permissions) > 0 {
		merged.Permissions = rs.Permissions
	}

	// Match buildUpdateRemoteSchema: update_remote_schema drops remote
	// relationships, so validate the post-update state without them.
	merged.RemoteRelationships = nil

	return merged
}

// remoteSchemaPermissionArgs is the {remote_schema, role, definition:{schema}}
// envelope used by add/drop_remote_schema_permissions.
type remoteSchemaPermissionArgs struct {
	RemoteSchema string                           `json:"remote_schema"`
	Role         string                           `json:"role"`
	Definition   hasura.RemoteSchemaPermissionDef `json:"definition"`
}

func (a remoteSchemaPermissionArgs) validate(op string, requireSchema bool) error {
	if a.RemoteSchema == "" || a.Role == "" {
		return fmt.Errorf(
			"%w: %s: remote_schema and role are required", errMissingRequiredField, op,
		)
	}

	if requireSchema && a.Definition.Schema == "" {
		return fmt.Errorf(
			"%w: %s: definition.schema is required", errMissingRequiredField, op,
		)
	}

	return nil
}

func buildAddRemoteSchemaPermissions(argsJSON []byte) (MutationFn, error) {
	var a remoteSchemaPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opAddRemoteSchemaPermissions, err)
	}

	if err := a.validate(opAddRemoteSchemaPermissions, true /* requireSchema */); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		rs := findRemoteSchema(h, a.RemoteSchema)
		if rs == nil {
			return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, a.RemoteSchema)
		}

		perms := sliceOf(rs.Permissions)
		for i := range perms {
			if perms[i].Role == a.Role {
				return CodeAlreadyExists, nil
			}
		}

		perms = append(perms, hasura.RemoteSchemaPermission{
			Role:       a.Role,
			Definition: a.Definition,
		})
		rs.Permissions = &perms

		return "", nil
	}, nil
}

// AddRemoteSchemaPermissions applies an add_remote_schema_permissions mutation.
// The new role's SDL is parse-validated (and the whole entry re-introspected)
// through validateRemoteSchema before persisting, guaranteeing the role-scoped
// schema builds during the subsequent state rebuild.
func (s *Store) AddRemoteSchemaPermissions(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	merged, name, exists, alreadyHasRole, err := s.remoteSchemaWithAddedPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	if !exists {
		return 0, "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, name)
	}

	if alreadyHasRole {
		return s.ResourceVersion(), CodeAlreadyExists, nil
	}

	if err := s.validateRemoteSchema(ctx, merged); err != nil {
		return 0, "", err
	}

	fn, err := buildAddRemoteSchemaPermissions(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

// remoteSchemaWithAddedPermission computes the prospective post-add entry under
// lock so validation runs against the final state. It reports whether the
// remote schema exists and whether the role already has a permission (an
// idempotent no-op).
func (s *Store) remoteSchemaWithAddedPermission(
	argsJSON []byte,
) (merged hasura.RemoteSchemaMetadata, name string, exists, alreadyHasRole bool, err error) {
	var a remoteSchemaPermissionArgs
	if err = json.Unmarshal(argsJSON, &a); err != nil {
		return merged, "", false, false, fmt.Errorf(
			"parsing %s args: %w", opAddRemoteSchemaPermissions, err,
		)
	}

	if err = a.validate(opAddRemoteSchemaPermissions, true /* requireSchema */); err != nil {
		return merged, a.RemoteSchema, false, false, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	existing := findRemoteSchema(s.hasura, a.RemoteSchema)
	if existing == nil {
		return merged, a.RemoteSchema, false, false, nil
	}

	merged = *existing

	existingPerms := sliceOf(existing.Permissions)
	for i := range existingPerms {
		if existingPerms[i].Role == a.Role {
			return merged, a.RemoteSchema, true, true, nil
		}
	}

	newPerms := append(
		append([]hasura.RemoteSchemaPermission(nil), existingPerms...),
		hasura.RemoteSchemaPermission{Role: a.Role, Definition: a.Definition},
	)
	merged.Permissions = &newPerms

	return merged, a.RemoteSchema, true, false, nil
}

func buildDropRemoteSchemaPermissions(argsJSON []byte) (MutationFn, error) {
	var a remoteSchemaPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opDropRemoteSchemaPermissions, err)
	}

	if err := a.validate(opDropRemoteSchemaPermissions, false /* requireSchema */); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		rs := findRemoteSchema(h, a.RemoteSchema)
		if rs == nil {
			return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, a.RemoteSchema)
		}

		perms := sliceOf(rs.Permissions)
		for i := range perms {
			if perms[i].Role == a.Role {
				perms = append(perms[:i], perms[i+1:]...)
				rs.Permissions = &perms

				return "", nil
			}
		}

		return "", fmt.Errorf(
			"%w: role %q on remote schema %q",
			ErrRemoteSchemaPermissionNotFound, a.Role, a.RemoteSchema,
		)
	}, nil
}

// DropRemoteSchemaPermissions applies a drop_remote_schema_permissions mutation.
// Removing a permission can only narrow the schema, so no introspection is run.
func (s *Store) DropRemoteSchemaPermissions(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildDropRemoteSchemaPermissions(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

type remoteSchemaByNameArgs struct {
	Name string `json:"name"`
}

// nativeRemoteSchemaByName looks up the named remote schema in the live
// snapshot and returns it in native form (URL/headers ready to resolve), or
// ErrRemoteSchemaNotFound when absent.
func (s *Store) nativeRemoteSchemaByName(name string) (metadata.RemoteSchemaMetadata, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.hasura == nil {
		return metadata.RemoteSchemaMetadata{}, ErrStoreNotInitialized
	}

	rs := findRemoteSchema(s.hasura, name)
	if rs == nil {
		return metadata.RemoteSchemaMetadata{}, fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, name)
	}

	return metadata.ConvertRemoteSchema(*rs), nil
}

// IntrospectRemoteSchema is the read handler for introspect_remote_schema. It
// resolves the named remote schema, introspects the upstream synchronously, and
// returns the raw introspection `data` document under a top-level "data" key
// (matching Hasura's `{ "data": { "__schema": ... } }` response). It never bumps
// resource_version.
func (s *Store) IntrospectRemoteSchema(
	ctx context.Context, argsJSON []byte,
) (map[string]any, error) {
	raw, err := s.introspectByName(ctx, argsJSON, opIntrospectRemoteSchema)
	if err != nil {
		return nil, err
	}

	return map[string]any{"data": stdjson.RawMessage(raw)}, nil
}

// ReloadRemoteSchema is the handler for reload_remote_schema. Hasura re-fetches
// the upstream schema and reports success without changing metadata, so this
// re-introspects (surfacing an unreachable endpoint as an error, like Hasura)
// and returns {"message": "success"} without bumping resource_version.
//
// NOTE: Constellation re-introspects the upstream on every state rebuild and
// keeps no cross-request introspection cache, so reload does not push a fresh
// schema into the running connector on its own; the refreshed schema takes
// effect on the next metadata change or restart. This divergence is invisible
// to the parity suite (static upstream) and documented in the support doc.
func (s *Store) ReloadRemoteSchema(
	ctx context.Context, argsJSON []byte,
) (map[string]any, error) {
	if _, err := s.introspectByName(ctx, argsJSON, opReloadRemoteSchema); err != nil {
		return nil, err
	}

	return map[string]any{"message": "success"}, nil
}

// remoteSchemaRemoteRelationshipArgs is the {remote_schema, type_name, name,
// definition} envelope for create/update_remote_schema_remote_relationship.
// delete omits definition.
type remoteSchemaRemoteRelationshipArgs struct {
	RemoteSchema string                                    `json:"remote_schema"`
	TypeName     string                                    `json:"type_name"`
	Name         string                                    `json:"name"`
	Definition   hasura.RemoteSchemaRelationshipDefinition `json:"definition"`
}

func (a remoteSchemaRemoteRelationshipArgs) validate(op string, requireDef bool) error {
	if a.RemoteSchema == "" || a.TypeName == "" || a.Name == "" {
		return fmt.Errorf(
			"%w: %s: remote_schema, type_name and name are required", errMissingRequiredField, op,
		)
	}

	if requireDef {
		hasSource, hasRemote := hasura.RemoteSchemaRelationshipKind(a.Definition)
		if hasSource == hasRemote {
			return fmt.Errorf(
				"%w: %s: definition must set exactly one of to_source or to_remote_schema",
				errMissingRequiredField, op,
			)
		}
	}

	return nil
}

// findRemoteSchemaTypeRel returns the relationships block for a type name on a
// remote schema, or nil when the type has no relationships yet.
func findRemoteSchemaTypeRel(
	rs *hasura.RemoteSchemaMetadata, typeName string,
) *hasura.RemoteSchemaTypeRemoteRelationship {
	if rs.RemoteRelationships == nil {
		return nil
	}

	rels := *rs.RemoteRelationships
	for i := range rels {
		if string(rels[i].TypeName) == typeName {
			return &rels[i]
		}
	}

	return nil
}

func buildCreateRemoteSchemaRemoteRelationship(argsJSON []byte) (MutationFn, error) {
	var a remoteSchemaRemoteRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opCreateRemoteSchemaRemoteRelationship, err)
	}

	if err := a.validate(
		opCreateRemoteSchemaRemoteRelationship,
		true, /* requireDef */
	); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		rs := findRemoteSchema(h, a.RemoteSchema)
		if rs == nil {
			return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, a.RemoteSchema)
		}

		rel := hasura.RemoteSchemaRelationshipDef{
			Name:       a.Name,
			Definition: a.Definition,
		}

		typeRel := findRemoteSchemaTypeRel(rs, a.TypeName)
		if typeRel == nil {
			typeRels := append(
				sliceOf(rs.RemoteRelationships),
				hasura.RemoteSchemaTypeRemoteRelationship{
					TypeName:      a.TypeName,
					Relationships: []hasura.RemoteSchemaRelationshipDef{rel},
				},
			)
			rs.RemoteRelationships = &typeRels

			return "", nil
		}

		for i := range typeRel.Relationships {
			if typeRel.Relationships[i].Name == a.Name {
				return CodeAlreadyExists, nil
			}
		}

		typeRel.Relationships = append(typeRel.Relationships, rel)

		return "", nil
	}, nil
}

// CreateRemoteSchemaRemoteRelationship applies a
// create_remote_schema_remote_relationship mutation (rs→db or rs→rs).
func (s *Store) CreateRemoteSchemaRemoteRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildCreateRemoteSchemaRemoteRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildUpdateRemoteSchemaRemoteRelationship(argsJSON []byte) (MutationFn, error) {
	var a remoteSchemaRemoteRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opUpdateRemoteSchemaRemoteRelationship, err)
	}

	if err := a.validate(
		opUpdateRemoteSchemaRemoteRelationship,
		true, /* requireDef */
	); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		rs := findRemoteSchema(h, a.RemoteSchema)
		if rs == nil {
			return "", fmt.Errorf("%w: %q", ErrRemoteSchemaNotFound, a.RemoteSchema)
		}

		typeRel := findRemoteSchemaTypeRel(rs, a.TypeName)
		if typeRel != nil {
			for i := range typeRel.Relationships {
				if typeRel.Relationships[i].Name == a.Name {
					typeRel.Relationships[i].Definition = a.Definition

					return "", nil
				}
			}
		}

		return "", fmt.Errorf(
			"%w: %q on type %q of remote schema %q",
			ErrRelationshipNotFound, a.Name, a.TypeName, a.RemoteSchema,
		)
	}, nil
}

// UpdateRemoteSchemaRemoteRelationship applies an
// update_remote_schema_remote_relationship mutation.
func (s *Store) UpdateRemoteSchemaRemoteRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildUpdateRemoteSchemaRemoteRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildDeleteRemoteSchemaRemoteRelationship(argsJSON []byte) (MutationFn, error) {
	var a remoteSchemaRemoteRelationshipArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opDeleteRemoteSchemaRemoteRelationship, err)
	}

	if err := a.validate(
		opDeleteRemoteSchemaRemoteRelationship,
		false, /* requireDef */
	); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		// delete_remote_schema_remote_relationship is idempotent in Hasura: a
		// missing schema/type/relationship returns success, not an error. Match
		// that (verified against a live engine in metadata_parity_test.go).
		rs := findRemoteSchema(h, a.RemoteSchema)
		if rs == nil {
			return "", nil
		}

		if rs.RemoteRelationships == nil {
			return "", nil
		}

		typeRels := *rs.RemoteRelationships
		for ti := range typeRels {
			typeRel := &typeRels[ti]
			if string(typeRel.TypeName) != a.TypeName {
				continue
			}

			for ri := range typeRel.Relationships {
				if typeRel.Relationships[ri].Name != a.Name {
					continue
				}

				typeRel.Relationships = append(
					typeRel.Relationships[:ri], typeRel.Relationships[ri+1:]...,
				)

				// Leave the now-empty type block in place: Hasura keeps
				// remote_relationships[].{type_name, relationships: []} after
				// the last relationship is dropped (verified in the parity suite).

				return "", nil
			}
		}

		return "", nil
	}, nil
}

// DeleteRemoteSchemaRemoteRelationship applies a
// delete_remote_schema_remote_relationship mutation.
func (s *Store) DeleteRemoteSchemaRemoteRelationship(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildDeleteRemoteSchemaRemoteRelationship(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func (s *Store) introspectByName(
	ctx context.Context, argsJSON []byte, op string,
) ([]byte, error) {
	var a remoteSchemaByNameArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", op, err)
	}

	if a.Name == "" {
		return nil, fmt.Errorf("%w: %s: name is required", errMissingRequiredField, op)
	}

	if s.rsIntrospector == nil {
		return nil, ErrRemoteSchemaIntrospectionUnavailable
	}

	native, err := s.nativeRemoteSchemaByName(a.Name)
	if err != nil {
		return nil, err
	}

	raw, err := s.rsIntrospector(ctx, &native)
	if err != nil {
		return nil, fmt.Errorf("introspecting remote schema %q: %w", a.Name, err)
	}

	return raw, nil
}
