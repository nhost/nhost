package controller

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

// dispatchBulk implements `bulk` (keepGoing=false → fail-fast on first error)
// and `bulk_keep_going` (keepGoing=true → run every child, collect per-child
// outcomes). Both run all children against ONE in-flight metadata copy with a
// single durable write and a single resource_version bump (see
// source.ApplyBulk), matching Hasura. Children accept the full native op set —
// mutations, reads, the whole-metadata ops, and nested bulk — exactly as Hasura
// does. The success body is a bare top-level JSON array of per-child results; a
// nested bulk child contributes a nested array, a nested bulk_atomic child a
// single {"message":"success"} object.
func (c *Controller) dispatchBulk( //nolint:ireturn
	ctx context.Context, argsJSON []byte, keepGoing bool,
) (api.MetadataRequestResponseObject, bool, error) {
	children, err := source.ParseBulkChildren(argsJSON)
	if err != nil {
		return handledError(codeParseFailed, err.Error(), "$.args")
	}

	results, _, _, err := c.store.ApplyBulk(ctx, children, keepGoing)
	if err != nil {
		// Fail-fast abort: a child failed and the whole batch was discarded. The
		// error carries the failing child's full index path (possibly nested).
		var childErr *source.BulkChildError
		if errors.As(err, &childErr) {
			code, message := c.classifyBulkChildError(childErr.Type, childErr.Err)

			return handledError(code, message, childErr.PathString())
		}

		// Engine-level failure (uninitialized / read-only / RV conflict / write).
		code, message := classifyMutationError(err)

		return handledError(code, message, "$.args")
	}

	return metadataBulkArrayResponse(c.renderBulkResults(results)), true, nil
}

// renderBulkResults renders a bulk's per-child results into the bare-array wire
// shape, recursing into nested bulks.
func (c *Controller) renderBulkResults(results []source.BulkResult) []any {
	out := make([]any, len(results))
	for i := range results {
		out[i] = c.renderBulkResult(results[i])
	}

	return out
}

// renderBulkResult renders one child result: a Hasura-shaped {code, error} for a
// failed (keep-going) child, a nested array for a nested bulk / bulk_keep_going
// child, or the success body otherwise (which for a nested bulk_atomic child is
// a single {"message":"success"} object).
func (c *Controller) renderBulkResult(r source.BulkResult) any {
	switch {
	case r.Err != nil:
		code, message := c.classifyBulkChildError(r.Type, r.Err)

		return map[string]any{"code": code, "error": message}
	case r.Array:
		return c.renderBulkResults(r.Children)
	default:
		return r.Body
	}
}

// classifyBulkChildError maps a child failure to the Hasura-shaped (code,
// message) pair, with friendlier messages for the bulk-specific cases: an op
// rejected inside an atomic group, nesting past the depth cap, and an op with no
// native handler.
func (c *Controller) classifyBulkChildError(childType string, err error) (string, string) {
	switch {
	case errors.Is(err, source.ErrBulkAtomicUnsupported):
		return codeNotSupported, err.Error()
	case errors.Is(err, source.ErrBulkNestingTooDeep):
		return codeNotSupported, fmt.Sprintf(
			"nested bulk exceeds the depth limit (op %q)",
			childType,
		)
	case errors.Is(err, source.ErrUnknownMutationOp):
		return codeNotSupported, fmt.Sprintf("op %q is not natively supported", childType)
	default:
		return classifyMutationError(err)
	}
}

// dispatchBulkAtomic implements `bulk_atomic`: every child's mutator is composed
// into one Apply (single clone, single write, single resource_version bump, all
// or nothing). Per Hasura, the accepted child set is a narrow whitelist (which
// excludes nested bulk) and the response is a single {"message":"success"}
// object — not a per-child array.
func (c *Controller) dispatchBulkAtomic( //nolint:ireturn
	ctx context.Context, argsJSON []byte,
) (api.MetadataRequestResponseObject, bool, error) {
	children, err := source.ParseBulkChildren(argsJSON)
	if err != nil {
		return handledError(codeParseFailed, err.Error(), "$.args")
	}

	fns := make([]source.MutationFn, len(children))

	for i, child := range children {
		if !source.BulkAtomicSupports(child.Type) {
			return handledError(
				codeNotSupported,
				fmt.Sprintf("%s (op %q)", source.ErrBulkAtomicUnsupported.Error(), child.Type),
				fmt.Sprintf("$.args[%d]", i),
			)
		}

		fn, bErr := source.BuildMutation(child.Type, child.Args)
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
