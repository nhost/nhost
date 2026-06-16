package controller

import (
	"context"
	stdjson "encoding/json"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// bulkArgs models the `args` field of a bulk / bulk_atomic /
// bulk_keep_going request. Hasura accepts either a bare array or
// {"args":[...]} envelope; the dashboard uses both shapes. We accept
// both by unmarshaling into either.
//
// Each child is a full metadata request (type + args), nested. We
// re-marshal the child's Args back to bytes for the per-op handlers.
type bulkChild struct {
	Type string             `json:"type"`
	Args stdjson.RawMessage `json:"args"`
}

// parseBulkChildren accepts either a bare array `[...]` or an object
// `{"args":[...]}`. Both shapes occur in the dashboard's emitted bulks.
func parseBulkChildren(argsJSON []byte) ([]bulkChild, error) {
	// Try bare array first.
	var arr []bulkChild
	if err := json.Unmarshal(argsJSON, &arr); err == nil {
		return arr, nil
	}

	// Fall back to envelope.
	var envelope struct {
		Args []bulkChild `json:"args"`
	}

	if err := json.Unmarshal(argsJSON, &envelope); err != nil {
		return nil, fmt.Errorf("parsing bulk args: %w", err)
	}

	return envelope.Args, nil
}

// dispatchBulk implements `bulk` (keepGoing=false → fail-fast on first
// error) and `bulk_keep_going` (keepGoing=true → run every child,
// collect per-child outcomes). Each child gets its own Apply call, so
// each successful child bumps the resource_version independently.
// Children are dispatched only through native Store handlers; an
// unknown op aborts (bulk) or fills its slot with a not-supported
// error (bulk_keep_going).
//
// Nested bulk in a child is rejected as not-supported to bound
// recursion; the dashboard's emitted bulks are flat.
func (c *Controller) dispatchBulk( //nolint:ireturn
	ctx context.Context, argsJSON []byte, keepGoing bool,
) (api.MetadataRequestResponseObject, bool) {
	children, err := parseBulkChildren(argsJSON)
	if err != nil {
		return metadataErrorResponse(codeParseFailed, err.Error(), "$.args"), true
	}

	results := make([]any, 0, len(children))

	for i, child := range children {
		entry, hardErr := c.dispatchBulkChild(ctx, i, child)
		if hardErr != nil {
			if !keepGoing {
				return metadataErrorResponse(
					hardErr.code, hardErr.message,
					fmt.Sprintf("$.args[%d]", i),
				), true
			}

			results = append(results, map[string]any{
				"code":  hardErr.code,
				"error": hardErr.message,
			})

			continue
		}

		results = append(results, entry)
	}

	return api.MetadataRequest200JSONResponse{
		"bulk": results,
	}, true
}

type bulkChildError struct {
	code    string
	message string
}

// dispatchBulkChild runs one child through the native single-op
// handlers. Returns either a result entry suitable for inclusion in
// the bulk response array, or a structured error for the caller to
// turn into an abort (bulk) or per-slot failure (bulk_keep_going).
func (c *Controller) dispatchBulkChild(
	ctx context.Context, idx int, child bulkChild,
) (map[string]any, *bulkChildError) {
	if child.Type == opBulk || child.Type == opBulkAtomic || child.Type == opBulkKeepGoing {
		return nil, &bulkChildError{
			code:    codeNotSupported,
			message: fmt.Sprintf("nested %q in bulk is not supported (child %d)", child.Type, idx),
		}
	}

	rv, code, err := c.dispatchSingleStoreOp(ctx, child.Type, []byte(child.Args))
	if err != nil {
		if errors.Is(err, source.ErrUnknownMutationOp) {
			return nil, &bulkChildError{
				code:    codeNotSupported,
				message: fmt.Sprintf("op %q is not natively supported (child %d)", child.Type, idx),
			}
		}

		errCode, message := classifyMutationError(err)

		return nil, &bulkChildError{code: errCode, message: message}
	}

	if code != "" {
		return map[string]any{"message": string(code)}, nil
	}

	return map[string]any{
		"message":          "success",
		"resource_version": rv,
	}, nil
}

// storeOp is one Store mutation method bound to its operation type. Every
// native single-op handler shares this signature.
type storeOp func(ctx context.Context, argsJSON []byte) (int64, source.IdempotencyCode, error)

// dispatchSingleStoreOp routes one op type to its Store method. Mirrors
// the switch in dispatchMutation, factored out so the bulk dispatcher
// can reuse it. The op is resolved through storeOpFor and invoked here so
// the Store error is wrapped once (keeping errors.Is against the source
// sentinels working for classifyMutationError).
func (c *Controller) dispatchSingleStoreOp(
	ctx context.Context, opType string, argsJSON []byte,
) (int64, source.IdempotencyCode, error) {
	op := c.storeOpFor(opType)
	if op == nil {
		return 0, "", fmt.Errorf("%w: %q", source.ErrUnknownMutationOp, opType)
	}

	rv, code, err := op(ctx, argsJSON)
	if err != nil {
		return 0, "", fmt.Errorf("%s: %w", opType, err)
	}

	return rv, code, nil
}

// storeOpFor returns the native Store handler for opType, or nil when the op
// has no native handler.
//
//nolint:cyclop,funlen // flat op-dispatch table; one arm per metadata op.
func (c *Controller) storeOpFor(opType string) storeOp {
	switch opType {
	case opPgTrackTable:
		return c.store.PgTrackTable
	case opPgSetTableCustomization:
		return c.store.PgSetTableCustomization
	case opPgCreateObjectRelationship:
		return c.store.PgCreateObjectRelationship
	case opPgCreateArrayRelationship:
		return c.store.PgCreateArrayRelationship
	case opPgCreateSelectPermission:
		return c.store.PgCreateSelectPermission
	case opPgDropSelectPermission:
		return c.store.PgDropSelectPermission
	case opPgCreateInsertPermission:
		return c.store.PgCreateInsertPermission
	case opPgDropInsertPermission:
		return c.store.PgDropInsertPermission
	case opPgCreateUpdatePermission:
		return c.store.PgCreateUpdatePermission
	case opPgDropUpdatePermission:
		return c.store.PgDropUpdatePermission
	case opPgCreateDeletePermission:
		return c.store.PgCreateDeletePermission
	case opPgDropDeletePermission:
		return c.store.PgDropDeletePermission
	case opPgUntrackTable:
		return c.store.PgUntrackTable
	case opPgSetTableIsEnum:
		return c.store.PgSetTableIsEnum
	case opPgDropRelationship:
		return c.store.PgDropRelationship
	case opPgRenameRelationship:
		return c.store.PgRenameRelationship
	case opPgTrackFunction:
		return c.store.PgTrackFunction
	case opPgUntrackFunction:
		return c.store.PgUntrackFunction
	case opPgSetFunctionCustomization:
		return c.store.PgSetFunctionCustomization
	case opPgCreateFunctionPermission:
		return c.store.PgCreateFunctionPermission
	case opPgDropFunctionPermission:
		return c.store.PgDropFunctionPermission
	case opPgCreateEventTrigger:
		return c.store.PgCreateEventTrigger
	case opPgDeleteEventTrigger:
		return c.store.PgDeleteEventTrigger
	case opPgCreateRemoteRelationship:
		return c.store.PgCreateRemoteRelationship
	case opPgDeleteRemoteRelationship:
		return c.store.PgDeleteRemoteRelationship
	}

	return nil
}

// dispatchBulkAtomic implements `bulk_atomic`: all children's mutators
// are composed into one Apply, giving free atomicity (single clone,
// single write, single RV bump). If any child errors the whole bulk
// rolls back — the snapshot and RV are unchanged. Per-child responses
// share the one final RV.
func (c *Controller) dispatchBulkAtomic( //nolint:ireturn
	ctx context.Context, argsJSON []byte,
) (api.MetadataRequestResponseObject, bool) {
	children, err := parseBulkChildren(argsJSON)
	if err != nil {
		return metadataErrorResponse(codeParseFailed, err.Error(), "$.args"), true
	}

	fns := make([]source.MutationFn, len(children))

	for i, child := range children {
		if child.Type == opBulk || child.Type == opBulkAtomic || child.Type == opBulkKeepGoing {
			return metadataErrorResponse(
				codeNotSupported,
				fmt.Sprintf("nested %q in bulk_atomic is not supported (child %d)", child.Type, i),
				fmt.Sprintf("$.args[%d]", i),
			), true
		}

		fn, err := source.BuildMutation(child.Type, []byte(child.Args))
		if err != nil {
			errCode, message := classifyMutationError(err)
			if errors.Is(err, source.ErrUnknownMutationOp) {
				errCode = codeNotSupported
			}

			return metadataErrorResponse(
				errCode, message,
				fmt.Sprintf("$.args[%d]", i),
			), true
		}

		fns[i] = fn
	}

	codes, rv, err := c.store.ApplyAll(ctx, fns)
	if err != nil {
		errCode, message := classifyMutationError(err)

		return metadataErrorResponse(errCode, message, "$.args"), true
	}

	results := make([]any, len(codes))

	for i, code := range codes {
		if code != "" {
			results[i] = map[string]any{"message": string(code)}

			continue
		}

		results[i] = map[string]any{
			"message":          "success",
			"resource_version": rv,
		}
	}

	return api.MetadataRequest200JSONResponse{
		"bulk": results,
	}, true
}
