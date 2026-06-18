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

// bulkChild models one child of a bulk / bulk_atomic / bulk_keep_going request.
// Hasura accepts either a bare array or a {"args":[...]} envelope; the dashboard
// uses both shapes, so parseBulkChildren accepts both. Each child is a full
// metadata request (type + args); the verbatim Args bytes are handed to the
// per-op handlers.
type bulkChild struct {
	Type string             `json:"type"`
	Args stdjson.RawMessage `json:"args"`
}

// errBulkArgsMissing is returned when a bulk request arrives as an object but
// carries no "args" key. Hasura rejects such a request; treating it as an empty
// (silently successful) bulk would mask a malformed call.
var errBulkArgsMissing = errors.New(`bulk request object is missing the "args" array`)

func parseBulkChildren(argsJSON []byte) ([]bulkChild, error) {
	// Bulk args may arrive as a bare array of children or wrapped in an object
	// with an "args" key. Try the bare array first.
	var arr []bulkChild
	if err := json.Unmarshal(argsJSON, &arr); err == nil {
		return arr, nil
	}

	// Otherwise it must be an object carrying an explicit "args" array. Decode
	// the envelope into a raw map so a missing key is distinguishable from a
	// present-but-non-array value: both are malformed and must fail loudly
	// rather than degrade to a zero-length (silently successful) bulk.
	var envelope map[string]stdjson.RawMessage
	if err := json.Unmarshal(argsJSON, &envelope); err != nil {
		return nil, fmt.Errorf("parsing bulk args: %w", err)
	}

	rawArgs, ok := envelope["args"]
	if !ok {
		return nil, errBulkArgsMissing
	}

	var children []bulkChild
	if err := json.Unmarshal(rawArgs, &children); err != nil {
		return nil, fmt.Errorf("parsing bulk args: %w", err)
	}

	return children, nil
}

// dispatchBulk implements `bulk` (keepGoing=false → fail-fast on first error)
// and `bulk_keep_going` (keepGoing=true → run every child, collect per-child
// outcomes). Both run all children against ONE in-flight metadata copy with a
// single durable write and a single resource_version bump (see
// source.ApplyBulk), matching Hasura. Children accept the full native op set —
// mutations, reads, and the whole-metadata ops — exactly as the single-op path
// does. The success body is a bare top-level JSON array of per-child results.
//
// Nested bulk in a child is reported as not-supported (the dashboard's emitted
// bulks are flat); see KNOWN_DIFFERENCES.md.
func (c *Controller) dispatchBulk( //nolint:ireturn
	ctx context.Context, argsJSON []byte, keepGoing bool,
) (api.MetadataRequestResponseObject, bool, error) {
	children, err := parseBulkChildren(argsJSON)
	if err != nil {
		return handledError(codeParseFailed, err.Error(), "$.args")
	}

	bulkChildren := make([]source.BulkChild, len(children))
	for i, child := range children {
		bulkChildren[i] = source.BulkChild{Type: child.Type, Args: []byte(child.Args)}
	}

	outcomes, _, _, err := c.store.ApplyBulk(ctx, bulkChildren, keepGoing)
	if err != nil {
		// Fail-fast abort: a child failed and the whole batch was discarded.
		var childErr *source.BulkChildError
		if errors.As(err, &childErr) {
			code, message := c.classifyBulkChildError(children[childErr.Index].Type, childErr.Err)

			return handledError(code, message, fmt.Sprintf("$.args[%d]", childErr.Index))
		}

		// Engine-level failure (uninitialized / read-only / RV conflict / write).
		code, message := classifyMutationError(err)

		return handledError(code, message, "$.args")
	}

	results := make([]any, len(outcomes))
	for i, outcome := range outcomes {
		if outcome.Err != nil {
			code, message := c.classifyBulkChildError(children[i].Type, outcome.Err)
			results[i] = map[string]any{"code": code, "error": message}

			continue
		}

		results[i] = outcome.Body
	}

	return metadataBulkArrayResponse(results), true, nil
}

// classifyBulkChildError maps a child failure to the Hasura-shaped (code,
// message) pair, with friendlier messages for the two bulk-specific cases:
// nested bulk and an op with no native handler.
func (c *Controller) classifyBulkChildError(childType string, err error) (string, string) {
	switch {
	case childType == opBulk || childType == opBulkAtomic || childType == opBulkKeepGoing:
		return codeNotSupported, fmt.Sprintf("nested %q in bulk is not supported", childType)
	case errors.Is(err, source.ErrUnknownMutationOp):
		return codeNotSupported, fmt.Sprintf("op %q is not natively supported", childType)
	default:
		return classifyMutationError(err)
	}
}

// bulkAtomicWhitelist is the set of ops Hasura's bulk_atomic accepts that
// Constellation also implements. Hasura additionally allows native-query /
// logical-model / stored-procedure track-untrack, which Constellation has no
// ops for. Everything else (table tracking, permissions, functions, event
// triggers, reads, whole-metadata) is rejected by Hasura's bulk_atomic, and
// Constellation matches that.
var bulkAtomicWhitelist = map[string]struct{}{
	opPgCreateObjectRelationship: {},
	opPgCreateArrayRelationship:  {},
	opPgDropRelationship:         {},
	opPgDeleteRemoteRelationship: {},
}

// errBulkAtomicUnsupported mirrors Hasura's "Bulk atomic does not support this
// command". Hasura raises it as an internal (500) error; Constellation surfaces
// it through its op-level 400 not-supported channel (500 is reserved for
// internal failures), which is the one deliberate deviation from Hasura here.
var errBulkAtomicUnsupported = errors.New("bulk_atomic does not support this command")

// dispatchBulkAtomic implements `bulk_atomic`: every child's mutator is composed
// into one Apply (single clone, single write, single resource_version bump, all
// or nothing). Per Hasura, the accepted child set is a narrow whitelist and the
// response is a single {"message":"success"} object — not a per-child array.
func (c *Controller) dispatchBulkAtomic( //nolint:ireturn
	ctx context.Context, argsJSON []byte,
) (api.MetadataRequestResponseObject, bool, error) {
	children, err := parseBulkChildren(argsJSON)
	if err != nil {
		return handledError(codeParseFailed, err.Error(), "$.args")
	}

	fns := make([]source.MutationFn, len(children))

	for i, child := range children {
		if _, ok := bulkAtomicWhitelist[child.Type]; !ok {
			return handledError(
				codeNotSupported,
				fmt.Sprintf("%s (op %q)", errBulkAtomicUnsupported.Error(), child.Type),
				fmt.Sprintf("$.args[%d]", i),
			)
		}

		fn, bErr := source.BuildMutation(child.Type, []byte(child.Args))
		if bErr != nil {
			errCode, message := classifyMutationError(bErr)
			if errors.Is(bErr, source.ErrUnknownMutationOp) {
				errCode = codeNotSupported
			}

			return handledError(errCode, message, fmt.Sprintf("$.args[%d]", i))
		}

		fns[i] = fn
	}

	if _, _, err := c.store.ApplyAll(ctx, fns); err != nil {
		errCode, message := classifyMutationError(err)

		return handledError(errCode, message, "$.args")
	}

	// Hasura returns a single success envelope for bulk_atomic, not an array.
	return api.MetadataRequest200JSONResponse{"message": "success"}, true, nil
}
