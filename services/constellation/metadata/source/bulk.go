package source

import (
	"context"
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// ApplyAll runs each MutationFn in sequence inside one Apply call. The
// returned codes slice is positionally aligned with fns: an empty slot
// means the child mutated; a non-empty slot is the idempotency code
// that child returned.
//
// All-or-nothing: the first child error rolls back the entire bulk
// (Apply discards its clone and leaves the in-memory snapshot
// untouched), and no rv is bumped. The returned rv is the new
// resource_version after a successful bulk; if every child was an
// idempotent no-op, rv is the current (unchanged) version and no write
// is issued.
//
// This is the primitive that backs bulk_atomic. bulk and
// bulk_keep_going are implemented at the dispatcher level by looping
// over single-op Apply calls (each child gets its own rv bump).
func (s *Store) ApplyAll(
	ctx context.Context, fns []MutationFn,
) ([]IdempotencyCode, int64, error) {
	// Mirror Apply's guards before the empty fast path: an empty bulk on an
	// uninitialized or read-only store is still an invalid request and must not
	// report success with the current version.
	if !s.initOnce.Load() {
		return nil, 0, ErrStoreNotInitialized
	}

	if s.writer == nil {
		return nil, 0, ErrStoreReadOnly
	}

	if len(fns) == 0 {
		return nil, s.ResourceVersion(), nil
	}

	codes := make([]IdempotencyCode, len(fns))

	rv, err := s.Apply(ctx, func(h *hasura.Metadata) error {
		anyMutation := false

		for i, fn := range fns {
			code, mErr := fn(h)
			if mErr != nil {
				return fmt.Errorf("bulk_atomic child %d: %w", i, mErr)
			}

			codes[i] = code

			if code == "" {
				anyMutation = true
			}
		}

		if !anyMutation {
			return errIdempotentNoOp
		}

		return nil
	})

	if errors.Is(err, errIdempotentNoOp) {
		return codes, s.ResourceVersion(), nil
	}

	if err != nil {
		return nil, 0, err
	}

	return codes, rv, nil
}
