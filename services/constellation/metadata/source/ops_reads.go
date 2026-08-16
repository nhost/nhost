package source

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

const (
	opPgSuggestRelationships = "pg_suggest_relationships"
	opPgGetViewdef           = "pg_get_viewdef"
)

// ErrReadOpRequiresDB is returned by read ops invoked on a Store that
// has no Queryer attached (e.g. file-source deployments). Maps to
// Hasura "not-supported".
var ErrReadOpRequiresDB = errors.New("operation requires a database-backed Store")

// ===== pg_suggest_relationships =====

type pgSuggestRelationshipsArgs struct {
	Source string               `json:"source"`
	Tables []hasura.TableSource `json:"tables,omitempty"`
	// OmitTracked filters out FKs whose object/array form is already in
	// the metadata. It decodes to false when the key is absent (a bool
	// has no presence tracking here); the dashboard sends omit_tracked
	// explicitly as false and filters already-tracked relationships
	// client-side, so it does not rely on a server-side default.
	OmitTracked bool `json:"omit_tracked,omitempty"`
}

// suggestedRelationship is one entry in the response: a directional
// relationship hint sourced from a Postgres FK. The dashboard renders
// these as "track suggested" actions.
type suggestedRelationship struct {
	Type string               `json:"type"` // "object" | "array"
	From relationshipEndpoint `json:"from"`
	To   relationshipEndpoint `json:"to"`
}

type relationshipEndpoint struct {
	Table   hasura.TableSource `json:"table"`
	Columns []string           `json:"columns"`
}

// PgSuggestRelationships returns FK-derived relationship suggestions
// for tables in the named source. The implementation queries
// information_schema for FK constraints, then emits both directions
// (object from the referencing side, array from the referenced side)
// for each FK. When OmitTracked is set, suggestions already present in
// the snapshot are filtered.
//
// The SQL always targets the metadata/primary connection pool; the
// source argument is used only to scope OmitTracked filtering and does
// not select a different database. Multi-source or separated-metadata-DB
// routing is not supported.
//
// Read-only: never bumps resource_version.
func (s *Store) PgSuggestRelationships(
	ctx context.Context, argsJSON []byte,
) (map[string]any, error) {
	// Snapshot the tracked metadata under the lock so omit_tracked filtering sees
	// a consistent view, then delegate to the lock-free core. The bulk engine
	// calls the core directly with its in-flight working copy while it already
	// holds s.mu (see ApplyBulk), which is why the core itself never locks.
	s.mu.Lock()
	h := s.hasura
	s.mu.Unlock()

	return s.pgSuggestRelationshipsAgainst(ctx, h, argsJSON)
}

// pgSuggestRelationshipsAgainst is the lock-free core of PgSuggestRelationships.
// It filters omit_tracked suggestions against the supplied metadata view rather
// than s.hasura, so a bulk child sees relationships created by earlier children
// in the same batch (matching Hasura, which runs bulk children against one
// in-flight metadata). The caller owns any locking.
func (s *Store) pgSuggestRelationshipsAgainst(
	ctx context.Context, view *hasura.Metadata, argsJSON []byte,
) (map[string]any, error) {
	var a pgSuggestRelationshipsArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgSuggestRelationships, err)
	}

	if s.queryer == nil {
		return nil, ErrReadOpRequiresDB
	}

	if !s.initOnce.Load() {
		return nil, ErrStoreNotInitialized
	}

	source := defaultIfEmpty(a.Source)

	// The query always runs against s.queryer (the metadata/primary pool);
	// the source arg does not route to a different database.
	suggestions, err := loadFKSuggestions(ctx, s.queryer, a.Tables)
	if err != nil {
		return nil, fmt.Errorf("loading FK suggestions: %w", err)
	}

	if a.OmitTracked {
		suggestions = filterTrackedRels(suggestions, view, source)
	}

	return map[string]any{"relationships": suggestions}, nil
}

// suggestRelationshipsSQL returns one row per (FK constraint, column position),
// with each referencing column paired to its referenced column BY POSITION.
//
// The referenced side is resolved via referential_constraints +
// key_column_usage joined on position_in_unique_constraint = ordinal_position,
// NOT via constraint_column_usage: the latter has no ordinal correlation, so a
// composite (multi-column) FK would cartesian-product into N*N mismatched
// column pairs. ORDER BY constraint + ordinal lets loadFKSuggestions group the
// per-column rows of one constraint into a single composite suggestion.
const suggestRelationshipsSQL = `
SELECT
  tc.constraint_schema AS constraint_schema,
  tc.constraint_name   AS constraint_name,
  tc.table_schema      AS from_schema,
  tc.table_name        AS from_table,
  kcu.column_name      AS from_column,
  fkcu.table_schema    AS to_schema,
  fkcu.table_name      AS to_table,
  fkcu.column_name     AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_schema = tc.table_schema
 AND kcu.table_name = tc.table_name
JOIN information_schema.key_column_usage fkcu
  ON fkcu.constraint_schema = rc.unique_constraint_schema
 AND fkcu.constraint_name = rc.unique_constraint_name
 AND fkcu.ordinal_position = kcu.position_in_unique_constraint
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('hdb_catalog', 'information_schema', 'pg_catalog')
ORDER BY tc.constraint_schema, tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position`

// foreignKey is one FK constraint with its ordered referencing/referenced
// column lists (a single entry for composite keys).
type foreignKey struct {
	from        hasura.TableSource
	to          hasura.TableSource
	fromColumns []string
	toColumns   []string
}

func loadFKSuggestions(
	ctx context.Context, q Queryer, scope []hasura.TableSource,
) ([]suggestedRelationship, error) {
	// Multi-row read: the Queryer interface exposes Query directly
	// (QueryRow is for single-row ops like pg_get_viewdef).
	rows, err := queryRows(ctx, q, suggestRelationshipsSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fks, err := collectForeignKeys(rows)
	if err != nil {
		return nil, err
	}

	scopeSet := scopeFilter(scope)

	// Each FK yields two suggestions: one object (from the referencing side)
	// and one array (from the referenced side).
	const suggestionsPerFK = 2

	out := make([]suggestedRelationship, 0, len(fks)*suggestionsPerFK)

	for _, fk := range fks {
		if scopeSet != nil {
			_, fromIn := scopeSet[tableKey(fk.from)]
			_, toIn := scopeSet[tableKey(fk.to)]

			if !fromIn && !toIn {
				continue
			}
		}

		out = append(
			out,
			suggestedRelationship{
				Type: "object",
				From: relationshipEndpoint{Table: fk.from, Columns: fk.fromColumns},
				To:   relationshipEndpoint{Table: fk.to, Columns: fk.toColumns},
			},
			suggestedRelationship{
				Type: "array",
				From: relationshipEndpoint{Table: fk.to, Columns: fk.toColumns},
				To:   relationshipEndpoint{Table: fk.from, Columns: fk.fromColumns},
			},
		)
	}

	return out, nil
}

// collectForeignKeys folds the per-column rows of suggestRelationshipsSQL into
// one foreignKey per constraint. It relies on the query's ORDER BY so a
// constraint's columns arrive contiguously: a row whose
// (constraint_schema, from_table, constraint_name) differs from the previous
// one starts a new foreignKey. The referencing table is part of the key
// because Postgres constraint names are unique per table, not per schema.
func collectForeignKeys(rows pgx.Rows) ([]foreignKey, error) {
	var (
		fks    []foreignKey
		curKey string
	)

	for rows.Next() {
		var (
			constraintSchema, constraintName  string
			fromSchema, fromTable, fromColumn string
			toSchema, toTable, toColumn       string
		)

		if err := rows.Scan(
			&constraintSchema, &constraintName,
			&fromSchema, &fromTable, &fromColumn,
			&toSchema, &toTable, &toColumn,
		); err != nil {
			return nil, fmt.Errorf("scanning FK row: %w", err)
		}

		// Postgres constraint names are unique per table, not per schema, so
		// the grouping key must include the referencing table (from_table /
		// tc.table_name). Keying on (schema, name) alone would merge two
		// same-named FKs on different tables into one corrupt suggestion.
		key := constraintSchema + "\x00" + fromTable + "\x00" + constraintName
		if len(fks) == 0 || key != curKey {
			fks = append(fks, foreignKey{
				from:        hasura.TableSource{Schema: fromSchema, Name: fromTable, Unknown: nil},
				to:          hasura.TableSource{Schema: toSchema, Name: toTable, Unknown: nil},
				fromColumns: nil,
				toColumns:   nil,
			})
			curKey = key
		}

		fk := &fks[len(fks)-1]
		fk.fromColumns = append(fk.fromColumns, fromColumn)
		fk.toColumns = append(fk.toColumns, toColumn)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating FK rows: %w", err)
	}

	return fks, nil
}

// queryRows runs a many-row query through the Store's Queryer. Thin
// wrapper kept so call sites read intent ("this is a multi-row read");
// the Queryer interface already requires Query.
func queryRows( //nolint:ireturn // returns pgx.Rows to satisfy the Queryer boundary interface.
	ctx context.Context, q Queryer, sql string, args ...any,
) (pgx.Rows, error) {
	return q.Query(ctx, sql, args...) //nolint:wrapcheck
}

func tableKey(t hasura.TableSource) string {
	return t.Schema + "." + t.Name
}

func scopeFilter(scope []hasura.TableSource) map[string]struct{} {
	if len(scope) == 0 {
		return nil
	}

	out := make(map[string]struct{}, len(scope))
	for _, t := range scope {
		out[tableKey(t)] = struct{}{}
	}

	return out
}

func filterTrackedRels(
	suggestions []suggestedRelationship, h *hasura.Metadata, source string,
) []suggestedRelationship {
	db := findDatabase(h, source)
	if db == nil {
		return suggestions
	}

	// Conservative filter: drop suggestions whose from-side is a tracked
	// table that already has an object/array relationship targeting the
	// to-side. This matches Hasura's omit_tracked behaviour roughly; the
	// dashboard re-validates server-side anyway.
	out := suggestions[:0]

	for _, s := range suggestions {
		if hasRelToTable(db, s.From.Table, s.Type, s.To.Table) {
			continue
		}

		out = append(out, s)
	}

	return out
}

func hasRelToTable(
	db *hasura.DatabaseMetadata, from hasura.TableSource,
	relType string, to hasura.TableSource,
) bool {
	for _, t := range db.Tables {
		if t.Table.Schema != from.Schema || t.Table.Name != from.Name {
			continue
		}

		if relType == "object" {
			for _, r := range t.ObjectRelationships {
				if remoteTableMatches(r.Using, to) {
					return true
				}
			}
		} else {
			for _, r := range t.ArrayRelationships {
				if remoteTableMatches(r.Using, to) {
					return true
				}
			}
		}
	}

	return false
}

func remoteTableMatches(u hasura.RelationshipUsing, to hasura.TableSource) bool {
	if u.ManualConfiguration != nil {
		t := u.ManualConfiguration.RemoteTable
		return t.Schema == to.Schema && t.Name == to.Name
	}

	if u.ForeignKeyConstraint != nil {
		t := u.ForeignKeyConstraint.Table
		return t.Schema == to.Schema && t.Name == to.Name
	}

	// The bare ForeignKeyColumns form (foreign_key_constraint_on as a string
	// or []string on the parent table) carries no target table in metadata,
	// so it cannot be matched here. Resolving it would require an
	// information_schema lookup; leave it unmatched.
	return false
}

// ===== pg_get_viewdef =====

type pgGetViewdefArgs struct {
	Source string             `json:"source"`
	Table  hasura.TableSource `json:"table"`
}

// PgGetViewdef returns the SQL definition of a view via pg_get_viewdef.
//
// The SQL always targets the metadata/primary connection pool; the
// source argument does not select a different database. Multi-source or
// separated-metadata-DB routing is not supported.
//
// Read-only.
func (s *Store) PgGetViewdef(
	ctx context.Context, argsJSON []byte,
) (map[string]any, error) {
	var a pgGetViewdefArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		return nil, fmt.Errorf("parsing %s args: %w", opPgGetViewdef, err)
	}

	if a.Table.Schema == "" || a.Table.Name == "" {
		return nil, fmt.Errorf(
			"%w: %s: table.schema and table.name are required",
			errMissingRequiredField, opPgGetViewdef,
		)
	}

	if s.queryer == nil {
		return nil, ErrReadOpRequiresDB
	}

	if !s.initOnce.Load() {
		return nil, ErrStoreNotInitialized
	}

	var def string

	regclass := fmt.Sprintf("%s.%s", quoteIdent(a.Table.Schema), quoteIdent(a.Table.Name))

	// The query always runs against s.queryer (the metadata/primary pool);
	// the source arg does not route to a different database.
	err := s.queryer.QueryRow(
		ctx, "SELECT pg_get_viewdef($1::regclass, true)", regclass,
	).Scan(&def)
	if err != nil {
		return nil, fmt.Errorf("fetching view definition: %w", err)
	}

	return map[string]any{"viewdef": def}, nil
}

// quoteIdent quotes a Postgres identifier for embedding in a regclass
// cast. Doubles any embedded double-quote to avoid breaking out of the
// quoted form.
func quoteIdent(s string) string {
	// surroundingQuotes is the two double-quote bytes wrapping the
	// identifier; pre-sized so the common (no embedded quote) case
	// avoids a reallocation.
	const surroundingQuotes = 2

	out := make([]byte, 0, len(s)+surroundingQuotes)
	out = append(out, '"')

	for i := range len(s) {
		if s[i] == '"' {
			out = append(out, '"', '"')
		} else {
			out = append(out, s[i])
		}
	}

	out = append(out, '"')

	return string(out)
}
