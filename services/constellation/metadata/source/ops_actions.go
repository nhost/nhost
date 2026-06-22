package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// reservedEnvVarPrefix is the env-var prefix Hasura forbids in action header
// value_from_env, so an action cannot exfiltrate the engine's own secrets
// (admin secret, JWT secret, database URLs) through a webhook header.
const reservedEnvVarPrefix = "HASURA_GRAPHQL_"

// ErrReservedEnvVarPrefix is returned by create_action / update_action when a
// header's value_from_env references a HASURA_GRAPHQL_* variable. The
// dispatcher maps it to the Hasura error code "parse-failed".
var ErrReservedEnvVarPrefix = errors.New(
	`env variables starting with "HASURA_GRAPHQL_" are not allowed in value_from_env`,
)

const (
	opCreateAction           = "create_action"
	opDropAction             = "drop_action"
	opUpdateAction           = "update_action"
	opCreateActionPermission = "create_action_permission"
	opDropActionPermission   = "drop_action_permission"
	opSetCustomTypes         = "set_custom_types"
)

// ErrActionNotFound is returned by drop/update/permission ops when no action
// with the given name is registered. The dispatcher maps it to the Hasura
// error code "not-exists".
var ErrActionNotFound = errors.New("action not found")

// ErrActionPermissionNotFound is returned by drop_action_permission when the
// named role has no permission on the action. Mapped to "not-exists".
var ErrActionPermissionNotFound = errors.New("action permission not found")

// buildActionMutation returns the MutationFn for the action / custom-type
// mutation ops, or ErrUnknownMutationOp. Kept parallel to
// buildRemoteSchemaMutation so BuildMutation stays under the cyclomatic limit;
// it is the bulk (non-atomic) entry point for these ops. Actions are
// deliberately absent from bulkAtomicWhitelist, matching Hasura's narrow
// bulk_atomic surface.
func buildActionMutation(opType string, argsJSON []byte) (MutationFn, error) {
	switch opType {
	case opCreateAction:
		return buildCreateAction(argsJSON)
	case opDropAction:
		return buildDropAction(argsJSON)
	case opUpdateAction:
		return buildUpdateAction(argsJSON)
	case opCreateActionPermission:
		return buildCreateActionPermission(argsJSON)
	case opDropActionPermission:
		return buildDropActionPermission(argsJSON)
	case opSetCustomTypes:
		return buildSetCustomTypes(argsJSON)
	case opAddInheritedRole:
		return buildAddInheritedRole(argsJSON)
	case opDropInheritedRole:
		return buildDropInheritedRole(argsJSON)
	}

	return nil, fmt.Errorf("%w: %q", ErrUnknownMutationOp, opType)
}

// findAction returns a pointer to the named action entry in h, or nil when it
// is not registered.
func findAction(h *hasura.Metadata, name string) *hasura.ActionMetadata {
	for i := range h.Actions {
		if h.Actions[i].Name == name {
			return &h.Actions[i]
		}
	}

	return nil
}

// parseActionInfo decodes the {name, definition, comment?} envelope shared by
// create_action and update_action into the wire model stored verbatim. It
// enforces the two invariants Hasura also requires: a name and a handler.
func parseActionInfo(argsJSON []byte, op string) (hasura.ActionMetadata, error) {
	var a hasura.ActionMetadata
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return a, fmt.Errorf("parsing %s args: %w", op, err)
	}

	if a.Name == "" {
		return a, fmt.Errorf("%w: %s: name is required", errMissingRequiredField, op)
	}

	if a.Definition.Handler == "" {
		return a, fmt.Errorf(
			"%w: %s: definition.handler is required", errMissingRequiredField, op,
		)
	}

	for i := range a.Definition.Headers {
		if env := a.Definition.Headers[i].Value.FromEnv; strings.HasPrefix(env, reservedEnvVarPrefix) {
			return a, fmt.Errorf("%w: %s", ErrReservedEnvVarPrefix, env)
		}
	}

	return a, nil
}

// actionPermissionArgs is the {action, role} envelope shared by
// create_action_permission and drop_action_permission. Hasura also accepts a
// comment and definition on create, but the native permission model stores
// only the role.
type actionPermissionArgs struct {
	Action string `json:"action"`
	Role   string `json:"role"`
}

func (a actionPermissionArgs) validate(op string) error {
	if a.Action == "" {
		return fmt.Errorf("%w: %s: action is required", errMissingRequiredField, op)
	}

	if a.Role == "" {
		return fmt.Errorf("%w: %s: role is required", errMissingRequiredField, op)
	}

	return nil
}

// CreateAction registers a new action. Re-creating an existing action is an
// idempotent no-op reported as CodeAlreadyExists.
func (s *Store) CreateAction(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildCreateAction(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildCreateAction(argsJSON []byte) (MutationFn, error) {
	action, err := parseActionInfo(argsJSON, opCreateAction)
	if err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		if findAction(h, action.Name) != nil {
			return CodeAlreadyExists, nil
		}

		h.Actions = append(h.Actions, action)

		return "", nil
	}, nil
}

// DropAction removes an action. Hasura's clear_data flag (which only affects
// the async action log) is accepted and ignored here.
func (s *Store) DropAction(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildDropAction(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildDropAction(argsJSON []byte) (MutationFn, error) {
	var a struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opDropAction, err)
	}

	if a.Name == "" {
		return nil, fmt.Errorf("%w: %s: name is required", errMissingRequiredField, opDropAction)
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		for i := range h.Actions {
			if h.Actions[i].Name == a.Name {
				h.Actions = append(h.Actions[:i], h.Actions[i+1:]...)

				return "", nil
			}
		}

		return "", fmt.Errorf("%w: %q", ErrActionNotFound, a.Name)
	}, nil
}

// UpdateAction replaces an existing action's definition and comment, preserving
// its permissions (matching Hasura's update_action semantics).
func (s *Store) UpdateAction(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildUpdateAction(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildUpdateAction(argsJSON []byte) (MutationFn, error) {
	updated, err := parseActionInfo(argsJSON, opUpdateAction)
	if err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		existing := findAction(h, updated.Name)
		if existing == nil {
			return "", fmt.Errorf("%w: %q", ErrActionNotFound, updated.Name)
		}

		existing.Definition = updated.Definition
		existing.Comment = updated.Comment

		return "", nil
	}, nil
}

// CreateActionPermission grants a role access to an action. Re-granting is an
// idempotent no-op reported as CodeAlreadyExists.
func (s *Store) CreateActionPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildCreateActionPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildCreateActionPermission(argsJSON []byte) (MutationFn, error) {
	var a actionPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opCreateActionPermission, err)
	}

	if err := a.validate(opCreateActionPermission); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		action := findAction(h, a.Action)
		if action == nil {
			return "", fmt.Errorf("%w: %q", ErrActionNotFound, a.Action)
		}

		for i := range action.Permissions {
			if action.Permissions[i].Role == a.Role {
				return CodeAlreadyExists, nil
			}
		}

		action.Permissions = append(action.Permissions, hasura.ActionPermission{Role: a.Role})

		return "", nil
	}, nil
}

// DropActionPermission revokes a role's access to an action.
func (s *Store) DropActionPermission(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildDropActionPermission(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildDropActionPermission(argsJSON []byte) (MutationFn, error) {
	var a actionPermissionArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opDropActionPermission, err)
	}

	if err := a.validate(opDropActionPermission); err != nil {
		return nil, err
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		action := findAction(h, a.Action)
		if action == nil {
			return "", fmt.Errorf("%w: %q", ErrActionNotFound, a.Action)
		}

		for i := range action.Permissions {
			if action.Permissions[i].Role == a.Role {
				action.Permissions = append(action.Permissions[:i], action.Permissions[i+1:]...)

				return "", nil
			}
		}

		return "", fmt.Errorf(
			"%w: role %q on action %q", ErrActionPermissionNotFound, a.Role, a.Action,
		)
	}, nil
}

// SetCustomTypes replaces the entire custom-type registry, matching Hasura's
// set_custom_types (a full replace, not a merge).
func (s *Store) SetCustomTypes(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	fn, err := buildSetCustomTypes(argsJSON)
	if err != nil {
		return 0, "", err
	}

	return s.applyOne(ctx, fn)
}

func buildSetCustomTypes(argsJSON []byte) (MutationFn, error) {
	var ct hasura.CustomTypes
	if err := json.Unmarshal(argsJSON, &ct); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opSetCustomTypes, err)
	}

	return func(h *hasura.Metadata) (IdempotencyCode, error) {
		h.CustomTypes = ct

		return "", nil
	}, nil
}
