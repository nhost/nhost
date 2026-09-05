package metadata

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// Inconsistency kinds mirror Hasura's metadata-inconsistency taxonomy. Two
// granularities live here side-by-side: source-level entries (database /
// remote_schema) drop a whole source; sub-source entries (table / column /
// function / relationship / enum_values) drop just one entity within the
// source so the rest keeps serving.
const (
	// InconsistencyKindDatabase reports that a database source failed to
	// build (factory error, customization error, etc.). The source is
	// dropped entirely.
	InconsistencyKindDatabase = "database"
	// InconsistencyKindRemoteSchema reports that a remote-schema source
	// failed to build. The source is dropped entirely.
	InconsistencyKindRemoteSchema = "remote_schema"
	// InconsistencyKindAction reports that action metadata was parsed but
	// cannot be exposed/executed in the current build, or that an optional
	// action metadata section failed to parse. The action is dropped.
	InconsistencyKindAction = "action"
	// InconsistencyKindCustomType reports that action custom-type metadata was
	// parsed but cannot be exposed in the current build, or that an optional
	// custom type metadata section failed to parse. The custom type is dropped.
	InconsistencyKindCustomType = "custom_type"
	// InconsistencyKindInheritedRole reports that an inherited role could not be
	// expanded into effective permissions: a parent role in its role_set is
	// unresolvable (absent, or itself an unresolved/cyclic inherited role). The
	// inherited role is dropped, mirroring Hasura's resolveInheritedRole. Name is
	// the inherited role name.
	InconsistencyKindInheritedRole = "inherited_role"
	// InconsistencyKindRole reports that schema composition failed for a
	// role (merge conflict, validation failure). The role is dropped.
	InconsistencyKindRole = "role"
	// InconsistencyKindTable reports that a table listed in metadata does
	// not exist in the source. The table is dropped from the source's
	// schema; the rest of the source keeps serving.
	InconsistencyKindTable = "table"
	// InconsistencyKindColumn reports that a column referenced by metadata
	// (column config, permission columns, set/check) does not exist on its
	// table. The reference is dropped; the rest of the table keeps serving.
	InconsistencyKindColumn = "column"
	// InconsistencyKindFunction reports that a function listed in metadata
	// does not exist in the source. The function is dropped.
	InconsistencyKindFunction = "function"
	// InconsistencyKindRelationship reports that a relationship's target
	// (or local column) does not exist. The relationship is dropped.
	InconsistencyKindRelationship = "relationship"
	// InconsistencyKindEnumValues reports that an enum-flagged table cannot
	// be used as an enum (no rows, invalid shape, query failure). The
	// table is dropped entirely so the input contract for any FK columns
	// pointing at it is not silently widened — same outcome as a missing
	// table, but recorded under a distinct kind so it is filterable.
	InconsistencyKindEnumValues = "enum_values"
)

// Inconsistency records a non-fatal failure encountered while turning a
// loaded metadata document into runtime state. The server keeps serving with
// whatever did load; consumers expose this list via /metadata/inconsistencies
// or similar surfaces.
type Inconsistency struct {
	// Kind classifies the failed entity. See the InconsistencyKind* constants.
	Kind string
	// Source is the owning source name (database / remote_schema) for
	// sub-source kinds (table, column, function, relationship, enum_values).
	// Empty for source-level (database, remote_schema) and role kinds.
	Source string
	// Name identifies the failed entity. Format depends on Kind:
	//   - database / remote_schema: the source name
	//   - role: the role name
	//   - table / enum_values: "schema.table"
	//   - column: "schema.table.column"
	//   - function: "schema.function"
	//   - relationship: "schema.table.relationship"
	Name string
	// Reason is a human-readable description of what went wrong.
	Reason string
	// At is the wall-clock time the inconsistency was recorded.
	At time.Time
}

// Inconsistencies is a thread-safe collector of Inconsistency entries. It is
// passed by pointer through the build/compose pipeline so partial failures
// end up in a single place that the controller can expose.
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

// Record builds an Inconsistency from the supplied fields, stamps it with the
// current wall-clock time, adds it to the collector, and (if logger is
// non-nil) logs it at warn level. A nil receiver is a no-op so callers
// threading an optional *Inconsistencies do not need a wrapper.
//
// Prefer the per-kind helpers (RecordDatabase, RecordTable, RecordColumn, ...)
// over calling Record directly: their named parameters surface the per-kind
// Name format at the call site, making the intended order clear (helpers still
// take multiple string parameters, so a same-type swap is not prevented by the
// compiler — it just becomes obvious in review). Record itself is reserved for
// the rare dynamic-kind path where the kind is computed at call time.
//
// Source may be empty for source-level (database, remote_schema) and role
// kinds; see the InconsistencyKind* constants for the per-kind Name format.
func (i *Inconsistencies) Record(
	ctx context.Context,
	logger *slog.Logger,
	kind, source, name, reason string,
) {
	if i == nil {
		return
	}

	inc := Inconsistency{
		Kind:   kind,
		Source: source,
		Name:   name,
		Reason: reason,
		At:     time.Now(),
	}

	i.mu.Lock()
	i.items = append(i.items, inc)
	i.mu.Unlock()

	if logger != nil {
		logger.WarnContext(
			ctx, "metadata inconsistency recorded",
			slog.String("kind", inc.Kind),
			slog.String("source", inc.Source),
			slog.String("name", inc.Name),
			slog.String("reason", inc.Reason),
		)
	}
}

// qualifyTable joins schema and table into the "schema.table" form used as the
// Name for table/enum_values inconsistencies. An empty schema yields just the
// table — matching how callers represent unqualified objects.
func qualifyTable(schema, table string) string {
	if schema == "" {
		return table
	}

	return schema + "." + table
}

// RecordDatabase records a source-level database inconsistency. Use this when
// a database source fails to build (factory error, customization error,
// unsupported kind): the whole source is dropped. name is the source name.
func (i *Inconsistencies) RecordDatabase(
	ctx context.Context,
	logger *slog.Logger,
	name, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindDatabase, "", name, reason)
}

// RecordRemoteSchema records a source-level remote-schema inconsistency. Use
// this when a remote-schema source fails to build: the whole source is
// dropped. name is the source name.
func (i *Inconsistencies) RecordRemoteSchema(
	ctx context.Context,
	logger *slog.Logger,
	name, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindRemoteSchema, "", name, reason)
}

// RecordAction records an action-level inconsistency. Use this when an action
// cannot be exposed or executed: the action is dropped while unrelated sources
// keep serving. name is the action name or optional action metadata file/section.
func (i *Inconsistencies) RecordAction(
	ctx context.Context,
	logger *slog.Logger,
	name, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindAction, "", name, reason)
}

// RecordCustomType records a custom-type inconsistency. Use this when an
// action custom type cannot be exposed: the type is dropped while unrelated
// sources keep serving. name is the custom type name or metadata section.
func (i *Inconsistencies) RecordCustomType(
	ctx context.Context,
	logger *slog.Logger,
	name, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindCustomType, "", name, reason)
}

// RecordLoadDiagnostic records a parser diagnostic from an optional metadata
// section as a fresh runtime inconsistency.
func (i *Inconsistencies) RecordLoadDiagnostic(
	ctx context.Context,
	logger *slog.Logger,
	diagnostic LoadDiagnostic,
) {
	i.Record(ctx, logger, diagnostic.Kind, diagnostic.Source, diagnostic.Name, diagnostic.Reason)
}

// RecordRole records a role-level inconsistency. Use this when schema
// composition fails for a role (merge conflict, validation failure): the role
// is dropped. name is the role name.
func (i *Inconsistencies) RecordRole(
	ctx context.Context,
	logger *slog.Logger,
	name, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindRole, "", name, reason)
}

// RecordTable records a missing-table inconsistency on source. The table is
// dropped from the source's schema; the rest of the source keeps serving.
func (i *Inconsistencies) RecordTable(
	ctx context.Context,
	logger *slog.Logger,
	source, schema, table, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindTable, source, qualifyTable(schema, table), reason)
}

// RecordEnumValues records that a table flagged is_enum cannot be used as an
// enum (no rows, invalid shape, query failure). The table is dropped entirely
// — see InconsistencyKindEnumValues for why.
func (i *Inconsistencies) RecordEnumValues(
	ctx context.Context,
	logger *slog.Logger,
	source, schema, table, reason string,
) {
	i.Record(ctx, logger, InconsistencyKindEnumValues, source, qualifyTable(schema, table), reason)
}

// RecordColumn records a missing-column inconsistency. The column reference
// is dropped (from column_config, permission column lists, or set maps); the
// rest of the table keeps serving.
func (i *Inconsistencies) RecordColumn(
	ctx context.Context,
	logger *slog.Logger,
	source, schema, table, column, reason string,
) {
	i.Record(
		ctx, logger,
		InconsistencyKindColumn,
		source,
		qualifyTable(schema, table)+"."+column,
		reason,
	)
}

// RecordFunction records a missing-function inconsistency on source. The
// function is dropped.
func (i *Inconsistencies) RecordFunction(
	ctx context.Context,
	logger *slog.Logger,
	source, schema, function, reason string,
) {
	i.Record(
		ctx, logger,
		InconsistencyKindFunction,
		source,
		qualifyTable(schema, function),
		reason,
	)
}

// RecordRelationship records that a relationship's target (or local column)
// does not exist. The relationship is dropped.
func (i *Inconsistencies) RecordRelationship(
	ctx context.Context,
	logger *slog.Logger,
	source, schema, table, relationship, reason string,
) {
	i.Record(
		ctx, logger,
		InconsistencyKindRelationship,
		source,
		qualifyTable(schema, table)+"."+relationship,
		reason,
	)
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
