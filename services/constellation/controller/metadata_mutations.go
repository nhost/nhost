package controller

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

const (
	opPgTrackTable               = "pg_track_table"
	opPgSetTableCustomization    = "pg_set_table_customization"
	opPgCreateObjectRelationship = "pg_create_object_relationship"
	opPgCreateArrayRelationship  = "pg_create_array_relationship"

	opPgCreateSelectPermission = "pg_create_select_permission"
	opPgDropSelectPermission   = "pg_drop_select_permission"
	opPgCreateInsertPermission = "pg_create_insert_permission"
	opPgDropInsertPermission   = "pg_drop_insert_permission"
	opPgCreateUpdatePermission = "pg_create_update_permission"
	opPgDropUpdatePermission   = "pg_drop_update_permission"
	opPgCreateDeletePermission = "pg_create_delete_permission"
	opPgDropDeletePermission   = "pg_drop_delete_permission"

	opPgUntrackTable       = "pg_untrack_table"
	opPgSetTableIsEnum     = "pg_set_table_is_enum"
	opPgDropRelationship   = "pg_drop_relationship"
	opPgRenameRelationship = "pg_rename_relationship"

	opPgSuggestRelationships = "pg_suggest_relationships"
	opPgGetViewdef           = "pg_get_viewdef"

	opPgTrackFunction            = "pg_track_function"
	opPgUntrackFunction          = "pg_untrack_function"
	opPgSetFunctionCustomization = "pg_set_function_customization"
	opPgCreateFunctionPermission = "pg_create_function_permission"
	opPgDropFunctionPermission   = "pg_drop_function_permission"

	opPgCreateEventTrigger = "pg_create_event_trigger"
	opPgDeleteEventTrigger = "pg_delete_event_trigger"
	opPgRedeliverEvent     = "pg_redeliver_event"
	opPgInvokeEventTrigger = "pg_invoke_event_trigger"
	opPgGetEventLogs       = "pg_get_event_logs"
	opPgGetEventByID       = "pg_get_event_by_id"

	opPgCreateRemoteRelationship = "pg_create_remote_relationship"
	opPgDeleteRemoteRelationship = "pg_delete_remote_relationship"

	opAddRemoteSchema             = "add_remote_schema"
	opRemoveRemoteSchema          = "remove_remote_schema"
	opUpdateRemoteSchema          = "update_remote_schema"
	opAddRemoteSchemaPermissions  = "add_remote_schema_permissions"
	opDropRemoteSchemaPermissions = "drop_remote_schema_permissions"
	opIntrospectRemoteSchema      = "introspect_remote_schema"
	opReloadRemoteSchema          = "reload_remote_schema"

	opReplaceMetadata = "replace_metadata"
	opClearMetadata   = "clear_metadata"
	opReloadMetadata  = "reload_metadata"

	opBulk          = "bulk"
	opBulkAtomic    = "bulk_atomic"
	opBulkKeepGoing = "bulk_keep_going"
)

// Hasura-shaped error codes returned in /v1/metadata 400 responses. These
// mirror the wire strings Hasura emits so existing clients (CLI, dashboard)
// keep classifying failures the same way.
const (
	codeParseFailed       = "parse-failed"
	codeConflict          = "conflict"
	codeNotExists         = "not-exists"
	codeDependencyError   = "dependency-error"
	codeNotSupported      = "not-supported"
	codeValidationFailed  = "validation-failed"
	codeRemoteSchemaError = "remote-schema-error"
	// codeAlreadyExists is the error-response (400) form, distinct from the
	// idempotency code of the same wire string returned in 200 bodies: here it
	// signals a hard naming conflict (e.g. renaming a relationship onto a name
	// already taken by a different one), not a successful no-op.
	codeAlreadyExists = "already-exists"
	// codeAlreadyUntracked mirrors Hasura's code for untracking a table that is
	// not tracked.
	codeAlreadyUntracked = "already-untracked"
)

// dispatchMutation routes a /v1/metadata request to its native Store
// handler when one is available. Returns (response, true) when the
// request was handled; (nil, false) when the dispatcher had no native
// handler and the caller should fall through to the proxy / unsupported
// path. A native handler that fails returns a 400 response (handled,
// true) — not a Go error — so the rest of the request lifecycle is
// uniform.
//
// Args arrive on the wire as map[string]interface{} (the OpenAPI
// generator does not know the per-op shape); handlers re-marshal then
// unmarshal into their typed args struct. The re-marshal is cheap
// relative to the database write.
// The switch is a flat op-dispatch table — one arm per metadata op — so the
// complexity/length linters are silenced rather than fragmenting it.
func (c *Controller) dispatchMutation( //nolint:ireturn,gocyclo,cyclop,funlen
	ctx context.Context,
	req api.MetadataRequestRequestObject,
) (api.MetadataRequestResponseObject, bool, error) {
	if c.store == nil {
		return nil, false, nil
	}

	// Args reaches the dispatcher as JSON bytes carved from the raw request body
	// (see metadataArgsJSON), preserving exact number literals before they reach
	// the stored metadata.
	argsJSON, err := metadataArgsJSON(ctx, req)
	if err != nil {
		return handledError(codeParseFailed, err.Error(), "$.args")
	}

	switch req.Body.Type {
	case opPgTrackTable:
		return finishMutation(c.store.PgTrackTable(ctx, argsJSON))
	case opPgSetTableCustomization:
		return finishMutation(c.store.PgSetTableCustomization(ctx, argsJSON))
	case opPgCreateObjectRelationship:
		return finishMutation(c.store.PgCreateObjectRelationship(ctx, argsJSON))
	case opPgCreateArrayRelationship:
		return finishMutation(c.store.PgCreateArrayRelationship(ctx, argsJSON))
	case opPgCreateSelectPermission:
		return finishMutation(c.store.PgCreateSelectPermission(ctx, argsJSON))
	case opPgDropSelectPermission:
		return finishMutation(c.store.PgDropSelectPermission(ctx, argsJSON))
	case opPgCreateInsertPermission:
		return finishMutation(c.store.PgCreateInsertPermission(ctx, argsJSON))
	case opPgDropInsertPermission:
		return finishMutation(c.store.PgDropInsertPermission(ctx, argsJSON))
	case opPgCreateUpdatePermission:
		return finishMutation(c.store.PgCreateUpdatePermission(ctx, argsJSON))
	case opPgDropUpdatePermission:
		return finishMutation(c.store.PgDropUpdatePermission(ctx, argsJSON))
	case opPgCreateDeletePermission:
		return finishMutation(c.store.PgCreateDeletePermission(ctx, argsJSON))
	case opPgDropDeletePermission:
		return finishMutation(c.store.PgDropDeletePermission(ctx, argsJSON))
	case opPgUntrackTable:
		return finishMutation(c.store.PgUntrackTable(ctx, argsJSON))
	case opPgSetTableIsEnum:
		return finishMutation(c.store.PgSetTableIsEnum(ctx, argsJSON))
	case opPgDropRelationship:
		return finishMutation(c.store.PgDropRelationship(ctx, argsJSON))
	case opPgRenameRelationship:
		return finishMutation(c.store.PgRenameRelationship(ctx, argsJSON))
	case opPgSuggestRelationships:
		return finishRead(c.store.PgSuggestRelationships(ctx, argsJSON))
	case opPgGetViewdef:
		return finishRead(c.store.PgGetViewdef(ctx, argsJSON))
	case opPgTrackFunction:
		return finishMutation(c.store.PgTrackFunction(ctx, argsJSON))
	case opPgUntrackFunction:
		return finishMutation(c.store.PgUntrackFunction(ctx, argsJSON))
	case opPgSetFunctionCustomization:
		return finishMutation(c.store.PgSetFunctionCustomization(ctx, argsJSON))
	case opPgCreateFunctionPermission:
		return finishMutation(c.store.PgCreateFunctionPermission(ctx, argsJSON))
	case opPgDropFunctionPermission:
		return finishMutation(c.store.PgDropFunctionPermission(ctx, argsJSON))
	case opPgCreateEventTrigger:
		return finishMutation(c.store.PgCreateEventTrigger(ctx, argsJSON))
	case opPgDeleteEventTrigger:
		return finishMutation(c.store.PgDeleteEventTrigger(ctx, argsJSON))
	case opPgCreateRemoteRelationship:
		return finishMutation(c.store.PgCreateRemoteRelationship(ctx, argsJSON))
	case opPgDeleteRemoteRelationship:
		return finishMutation(c.store.PgDeleteRemoteRelationship(ctx, argsJSON))
	case opAddRemoteSchema:
		return finishMutation(c.store.AddRemoteSchema(ctx, argsJSON))
	case opRemoveRemoteSchema:
		return finishMutation(c.store.RemoveRemoteSchema(ctx, argsJSON))
	case opUpdateRemoteSchema:
		return finishMutation(c.store.UpdateRemoteSchema(ctx, argsJSON))
	case opAddRemoteSchemaPermissions:
		return finishMutation(c.store.AddRemoteSchemaPermissions(ctx, argsJSON))
	case opDropRemoteSchemaPermissions:
		return finishMutation(c.store.DropRemoteSchemaPermissions(ctx, argsJSON))
	case opIntrospectRemoteSchema:
		return finishRead(c.store.IntrospectRemoteSchema(ctx, argsJSON))
	case opReloadRemoteSchema:
		return finishRead(c.store.ReloadRemoteSchema(ctx, argsJSON))
	case opReplaceMetadata:
		return finishMutation(c.store.ReplaceMetadata(ctx, argsJSON))
	case opClearMetadata:
		return finishMutation(c.store.ClearMetadata(ctx, argsJSON))
	case opReloadMetadata:
		return finishMutation(c.store.ReloadMetadata(ctx, argsJSON))
	case opPgRedeliverEvent,
		opPgInvokeEventTrigger,
		opPgGetEventLogs,
		opPgGetEventByID:
		return handledError(
			codeNotSupported,
			"event delivery runtime is not implemented; only metadata authoring "+
				"of event triggers is supported",
			"$.args",
		)
	case opBulk:
		return c.dispatchBulk(ctx, argsJSON, false /* keepGoing */)
	case opBulkKeepGoing:
		return c.dispatchBulk(ctx, argsJSON, true /* keepGoing */)
	case opBulkAtomic:
		return c.dispatchBulkAtomic(ctx, argsJSON)
	}

	return nil, false, nil
}

// metadataArgsJSON returns the verbatim JSON bytes of the request's `args`
// field. It prefers the raw captured request body (stashed by
// NewCaptureRawBody) so number literals keep full precision:
// api.MetadataRequest decodes args through encoding/json v1 into interface{},
// turning every number into a float64, so re-marshaling that decoded value
// would round integer literals beyond 2^53 and normalize formatting before they
// reach the stored metadata. When the raw body was not captured (e.g. a unit
// test invoking the dispatcher directly), it falls back to re-marshaling the
// decoded args.
func metadataArgsJSON(
	ctx context.Context, req api.MetadataRequestRequestObject,
) ([]byte, error) {
	if raw := rawBodyFromContext(ctx); len(raw) > 0 {
		var envelope struct {
			Args jsontext.Value `json:"args"`
		}

		if err := json.Unmarshal(raw, &envelope); err == nil && len(envelope.Args) > 0 {
			return []byte(envelope.Args), nil
		}
	}

	out, err := json.Marshal(req.Body.Args)
	if err != nil {
		return nil, fmt.Errorf("marshaling metadata args: %w", err)
	}

	return out, nil
}

// finishMutation turns the (rv, idempotencyCode, err) triple a Store op
// returns into the wire response. On success it emits 200 with the new
// resource_version; on idempotent no-op it emits 200 with the
// idempotency code; on error it emits 400 with a per-class code.
func finishMutation( //nolint:ireturn
	rv int64, code source.IdempotencyCode, err error,
) (api.MetadataRequestResponseObject, bool, error) {
	if err != nil {
		errCode, message := classifyMutationError(err)

		return handledError(errCode, message, "$.args")
	}

	if code != "" {
		// Idempotent outcome — return the code in the body but leave
		// resource_version absent (the row was not bumped).
		return api.MetadataRequest200JSONResponse{
			"message": string(code),
		}, true, nil
	}

	return api.MetadataRequest200JSONResponse{
		"message":          "success",
		"resource_version": rv,
	}, true, nil
}

// finishRead turns a (body, err) pair from a read-only op into the
// wire response. Reads never bump resource_version and have no
// idempotency notion: success = 200 with the body, error = 400 with a
// classified code.
func finishRead( //nolint:ireturn
	body map[string]any, err error,
) (api.MetadataRequestResponseObject, bool, error) {
	if err != nil {
		errCode, message := classifyMutationError(err)

		return handledError(errCode, message, "$.args")
	}

	return api.MetadataRequest200JSONResponse(body), true, nil
}

// classifyMutationError maps a Store-level error to the Hasura-shaped
// error code + message pair used in 400 responses.
func classifyMutationError(err error) (string, string) {
	switch {
	case errors.Is(err, source.ErrResourceVersionConflict):
		return codeConflict, err.Error()
	case errors.Is(err, source.ErrSourceNotFound),
		errors.Is(err, source.ErrTableNotTracked),
		errors.Is(err, source.ErrPermissionNotFound),
		errors.Is(err, source.ErrRelationshipNotFound),
		errors.Is(err, source.ErrFunctionNotTracked),
		errors.Is(err, source.ErrEventTriggerNotFound),
		errors.Is(err, source.ErrRemoteSchemaNotFound),
		errors.Is(err, source.ErrRemoteSchemaPermissionNotFound):
		return codeNotExists, err.Error()
	case errors.Is(err, source.ErrTableHasDependents):
		return codeDependencyError, err.Error()
	case errors.Is(err, source.ErrRelationshipExists),
		errors.Is(err, source.ErrPermissionExists):
		return codeAlreadyExists, err.Error()
	case errors.Is(err, source.ErrTableAlreadyUntracked):
		return codeAlreadyUntracked, err.Error()
	case errors.Is(err, source.ErrStoreNotInitialized),
		errors.Is(err, source.ErrStoreReadOnly),
		errors.Is(err, source.ErrReadOpRequiresDB),
		errors.Is(err, source.ErrRemoteSchemaIntrospectionUnavailable):
		return codeNotSupported, err.Error()
	case errors.Is(err, remoteschema.ErrIntrospection):
		// An unreachable / errorful upstream during add/update/introspect:
		// matches Hasura's remote-schema-error code.
		return codeRemoteSchemaError, err.Error()
	}

	// Catch-all. Parse errors are surfaced by handlers as plain wrapped
	// json.Unmarshal failures; treat anything else as a validation
	// failure (closest Hasura code for "the args were syntactically OK
	// but didn't make sense").
	return codeValidationFailed, err.Error()
}
