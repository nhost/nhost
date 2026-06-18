package source

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// emptyMetadataJSON is the seed for clear_metadata — a valid Hasura v3
// envelope with no sources or remote schemas. Round-trips through
// FromJSON/ToJSON cleanly.
const emptyMetadataJSON = `{"version":3,"sources":[]}`

// replaceMetadataArgs accepts Hasura's two args shapes:
//   - bare envelope: `{"version":3,"sources":[...], ...}`
//   - wrapper:        `{"metadata":{...}, "resource_version":N, "allow_inconsistent_metadata":bool}`
//
// We detect the wrapper by the presence of a top-level "metadata" key. The
// optional resource_version is the caller's expected current version, used for
// optimistic-concurrency control; it is only carried by the wrapper form.
type replaceMetadataArgs struct {
	Metadata        jsontext.Value `json:"metadata,omitempty"`
	ResourceVersion *int64         `json:"resource_version,omitempty"`
}

// ReplaceMetadata applies replace_metadata: swap the whole snapshot to
// a caller-provided payload. Goes through Apply so OCC + broadcast +
// the existing single-write semantics are preserved. If the args carry an
// expected resource_version (wrapper form only) that disagrees with the
// current version, it returns ErrResourceVersionConflict before touching
// the snapshot.
func (s *Store) ReplaceMetadata(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	newRaw, expectedRV, err := extractReplacePayload(argsJSON)
	if err != nil {
		return 0, "", err
	}

	// Validate by parsing once up front. Apply's clone-then-mutate
	// will re-parse during the swap, but we want a clean error
	// (parse-failed) for a malformed payload before touching the DB.
	newH, err := hasura.FromJSON(newRaw)
	if err != nil {
		return 0, "", fmt.Errorf("parsing replace_metadata payload: %w", err)
	}

	// Thread the caller's expected resource_version into the locked write so the
	// optimistic-concurrency precondition is enforced atomically with the swap.
	// Checking it here (outside Apply's lock) would leave a window in which a
	// concurrent admin mutation could bump the version between the check and the
	// write, silently discarding that change instead of returning a conflict.
	rv, err := s.apply(ctx, expectedRV, func(h *hasura.Metadata) error {
		*h = *newH

		return nil
	})
	if err != nil {
		return 0, "", err
	}

	return rv, "", nil
}

// extractReplacePayload returns the raw Hasura wire JSON to swap in along with
// the caller's optional expected resource_version. Accepts both the bare
// envelope and the {metadata: ...} wrapper; only the wrapper form carries a
// resource_version, so the bare envelope yields a nil expected version.
func extractReplacePayload(argsJSON []byte) ([]byte, *int64, error) {
	var wrapper replaceMetadataArgs
	if err := json.Unmarshal(argsJSON, &wrapper); err == nil && len(wrapper.Metadata) > 0 {
		return []byte(wrapper.Metadata), wrapper.ResourceVersion, nil
	}

	// Treat the args themselves as the metadata envelope.
	if len(argsJSON) == 0 {
		return nil, nil, fmt.Errorf("%w: replace_metadata: empty args", errMissingRequiredField)
	}

	return argsJSON, nil, nil
}

// ClearMetadata applies clear_metadata: swap to an empty Hasura v3
// envelope. Args are ignored (Hasura accepts none).
func (s *Store) ClearMetadata(
	ctx context.Context, _ []byte,
) (int64, IdempotencyCode, error) {
	empty, err := hasura.FromJSON([]byte(emptyMetadataJSON))
	if err != nil {
		// Programming error: the constant above must round-trip.
		return 0, "", fmt.Errorf("parsing empty metadata seed: %w", err)
	}

	rv, err := s.Apply(ctx, func(h *hasura.Metadata) error {
		*h = *empty

		return nil
	})
	if err != nil {
		return 0, "", err
	}

	return rv, "", nil
}

// ReloadMetadata re-fetches hdb_metadata via the Store's Queryer,
// replaces the in-memory snapshot, and broadcasts on Watch. Unlike
// Apply, this does not write — it picks up an external write performed
// by some other process. Resource version is taken from the database.
//
// Returns the freshly loaded resource_version.
func (s *Store) ReloadMetadata(ctx context.Context, _ []byte) (int64, IdempotencyCode, error) {
	if !s.initOnce.Load() {
		return 0, "", ErrStoreNotInitialized
	}

	if s.queryer == nil {
		return 0, "", ErrReadOpRequiresDB
	}

	// Hold s.mu across BOTH the database read and the in-memory swap so a
	// concurrent Apply cannot interleave between them. Reading the row
	// outside the lock and swapping under it would let an Apply commit a
	// newer (raw, rv) in the gap, which this reload would then clobber back
	// to the stale snapshot it read — leaving resource_version trailing the
	// database and wedging every later Apply into a resource_version
	// conflict. Apply itself already holds s.mu across its own DB round-trip,
	// so this matches the established locking discipline.
	s.mu.Lock()
	defer s.mu.Unlock()

	var (
		raw []byte
		rv  int64
	)

	err := s.queryer.QueryRow(
		ctx,
		"SELECT metadata, resource_version FROM hdb_catalog.hdb_metadata WHERE id = 1",
	).Scan(&raw, &rv)
	if err != nil {
		return 0, "", fmt.Errorf("reload_metadata: fetching hdb_metadata: %w", err)
	}

	h, err := hasura.FromJSON(raw)
	if err != nil {
		return 0, "", fmt.Errorf("reload_metadata: parsing snapshot: %w", err)
	}

	s.hasura = h
	s.native = mustFromHasura(raw)
	s.raw = raw
	s.resourceVersion = rv

	// Broadcast within the same critical section as the swap, mirroring
	// Apply, so the published snapshot is always the state we just stored
	// and a concurrent Apply cannot interleave a newer broadcast in between.
	s.broadcastLocked(metadata.Update{Metadata: s.native, Err: nil})

	return rv, "", nil
}

// ReloadIfStale reloads the in-memory snapshot from the database only when
// notifiedRV is newer than the version the Store currently holds. It is the
// callback the cross-replica notify listener invokes (see ListenAndReload): a
// notifiedRV of 0 — an unparseable payload — forces an unconditional reload.
// When the Store is already at or ahead of notifiedRV this is a no-op, so a
// replica does not pointlessly reload in response to its own write.
func (s *Store) ReloadIfStale(
	ctx context.Context, notifiedRV int64,
) (int64, IdempotencyCode, error) {
	if notifiedRV != 0 && notifiedRV <= s.ResourceVersion() {
		return s.ResourceVersion(), "", nil
	}

	return s.ReloadMetadata(ctx, nil)
}

// ReconcileAfterProxy refreshes the in-memory snapshot from the database after
// a metadata op was forwarded to the Hasura upstream proxy. The upstream writes
// to the same hdb_catalog.hdb_metadata the Store owns, so without this the
// native snapshot (and export_metadata) would not reflect the proxied change.
// When the proxied op actually advanced the version it also announces the
// change to peer replicas, since the upstream's own write does not emit
// Constellation's notification. A Store with no database handle (file source)
// has nothing to reconcile and returns nil.
func (s *Store) ReconcileAfterProxy(ctx context.Context) error {
	if s.queryer == nil {
		return nil
	}

	before := s.ResourceVersion()

	rv, _, err := s.ReloadMetadata(ctx, nil)
	if err != nil {
		return err
	}

	if rv > before {
		if err := notifyMetadataChange(ctx, s.queryer, rv); err != nil {
			return fmt.Errorf("notifying peers after proxied write: %w", err)
		}
	}

	return nil
}
