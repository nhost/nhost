package metadata

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// Inconsistency kinds. These mirror Hasura's metadata-inconsistency taxonomy:
// a source we tried but failed to wire (database / remote_schema) or a per-role
// composition step that broke after the connectors themselves loaded fine.
const (
	InconsistencyKindDatabase     = "database"
	InconsistencyKindRemoteSchema = "remote_schema"
	InconsistencyKindRole         = "role"
)

// Inconsistency records a non-fatal failure that happened while turning a
// loaded metadata document into runtime state. The server keeps serving with
// the remaining (consistent) parts of the metadata; consumers expose this list
// via /metadata/inconsistencies or similar surfaces.
type Inconsistency struct {
	// Kind classifies what kind of entity failed to load. See the
	// InconsistencyKind* constants.
	Kind string
	// Name is the entity name (database name, remote-schema name, or — for
	// Kind=role — the role name).
	Name string
	// Role is the role the inconsistency applies to, when it is role-scoped
	// (currently only Kind=role uses this and stores the role in Name; Role is
	// left here for future per-role variants of source-level inconsistencies).
	Role string
	// Reason is a human-readable description of what went wrong.
	Reason string
	// At is the wall-clock time the inconsistency was recorded.
	At time.Time
}

// Inconsistencies is a thread-safe collector of Inconsistency entries. It is
// passed by pointer to the build/compose pipeline so partial failures end up
// in a single place that the controller can later expose.
type Inconsistencies struct {
	mu    sync.Mutex
	items []Inconsistency
}

// NewInconsistencies returns an empty collector.
func NewInconsistencies() *Inconsistencies {
	return &Inconsistencies{
		mu:    sync.Mutex{},
		items: nil,
	}
}

// Record adds an entry to the collector and logs it through logger at warn
// level so operators see partial-failure events as they happen. Pass a nil
// logger to skip logging (used by tests that only care about the collected
// items).
func (i *Inconsistencies) Record(
	ctx context.Context,
	logger *slog.Logger,
	kind, name, reason string,
) {
	inc := Inconsistency{
		Kind:   kind,
		Name:   name,
		Role:   "",
		Reason: reason,
		At:     time.Now(),
	}

	i.mu.Lock()
	i.items = append(i.items, inc)
	i.mu.Unlock()

	if logger != nil {
		logger.WarnContext(ctx, "metadata inconsistency recorded",
			slog.String("kind", kind),
			slog.String("name", name),
			slog.String("reason", reason),
		)
	}
}

// Snapshot returns a copy of the currently recorded inconsistencies. The
// returned slice is independent of the collector so callers may retain it
// across further mutations.
func (i *Inconsistencies) Snapshot() []Inconsistency {
	i.mu.Lock()
	defer i.mu.Unlock()

	out := make([]Inconsistency, len(i.items))
	copy(out, i.items)

	return out
}

// Len returns the number of recorded inconsistencies.
func (i *Inconsistencies) Len() int {
	i.mu.Lock()
	defer i.mu.Unlock()

	return len(i.items)
}
