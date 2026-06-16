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
//   - wrapper:        `{"metadata":{...}, "allow_inconsistent_metadata":bool}`
//
// We detect the wrapper by the presence of a top-level "metadata" key.
type replaceMetadataArgs struct {
	Metadata jsontext.Value `json:"metadata,omitempty"`
}

// ReplaceMetadata applies replace_metadata: swap the whole snapshot to
// a caller-provided payload. Goes through Apply so OCC + broadcast +
// the existing single-write semantics are preserved.
func (s *Store) ReplaceMetadata(
	ctx context.Context, argsJSON []byte,
) (int64, IdempotencyCode, error) {
	newRaw, err := extractReplacePayload(argsJSON)
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

	rv, err := s.Apply(ctx, func(h *hasura.Metadata) error {
		*h = *newH

		return nil
	})
	if err != nil {
		return 0, "", err
	}

	return rv, "", nil
}

// extractReplacePayload returns the raw Hasura wire JSON to swap in.
// Accepts both the bare envelope and the {metadata: ...} wrapper.
func extractReplacePayload(argsJSON []byte) ([]byte, error) {
	var wrapper replaceMetadataArgs
	if err := json.Unmarshal(argsJSON, &wrapper); err == nil && len(wrapper.Metadata) > 0 {
		return []byte(wrapper.Metadata), nil
	}

	// Treat the args themselves as the metadata envelope.
	if len(argsJSON) == 0 {
		return nil, fmt.Errorf("%w: replace_metadata: empty args", errMissingRequiredField)
	}

	return argsJSON, nil
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
