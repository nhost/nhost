package source

import (
	"context"
	json "encoding/json/v2"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// untrackDeps holds the database facts a faithful pg_untrack_table cascade needs
// but the metadata snapshot cannot supply. It is loaded once, before Apply, from
// the Store's Queryer, and is nil for a metadata-only cascade (no DB handle, or a
// non-cascade untrack).
type untrackDeps struct {
	// fkByOwnerCols resolves a bare foreign_key_constraint_on (columns that live
	// on the relationship's own table) to the table the FK references. Hasura's
	// metadata records only the columns for that relationship form, not the
	// target table, so without this the cascade cannot tell that the
	// relationship points at the untracked table. Key: fkOwnerKey(owner, cols).
	fkByOwnerCols map[string]hasura.TableSource

	// funcsReturningTarget is the set of functions whose return type is the
	// untracked table (SETOF <table> or bare <table>). Hasura untracks these on
	// cascade because a function returning an untracked table has no valid
	// GraphQL type. Keyed by funcKey(schema, name); function overloads collapse
	// to the single tracked entry, which is matched by name only.
	funcsReturningTarget map[string]struct{}
}

// funcReturnTableSQL returns one row per function whose return type is the
// composite type backing the given table (matching both `RETURNS <table>` and
// `RETURNS SETOF <table>`, since both carry the table's composite type as
// prorettype). typrelid is non-zero only for composite types, so the join to
// pg_class naturally excludes scalar-returning functions.
const funcReturnTableSQL = `
SELECT n.nspname AS func_schema, p.proname AS func_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_type t ON t.oid = p.prorettype
JOIN pg_class c ON c.oid = t.typrelid
JOIN pg_namespace cn ON cn.oid = c.relnamespace
WHERE cn.nspname = $1 AND c.relname = $2`

// loadUntrackDeps introspects the database facts the cascade needs but the
// metadata cannot supply: the foreign-key graph and function return types of
// the untracked table's *source data database*.
//
// The introspection targets the source's own connection (resolved from its
// connection_info.database_url), not the Store's metadata-store handle. In a
// normal deployment these are the same Postgres (Hasura's hdb_metadata lives in
// the data database), but they can be separated — Constellation's metadata in a
// dedicated database, the user tables in another — and the FK graph / function
// return types live with the user tables. The connection is short-lived:
// pg_untrack_table is a rare admin op, so a per-call connection is cheaper than
// a Store-lifetime pool and avoids adding pool lifecycle to the Store.
//
// It returns (nil, nil) — a metadata-only cascade — when the op is not a
// cascade, the source has no resolvable data URL (file source, unset env), or
// the data database is unreachable. The metadata-only cascade still drops
// relationships with metadata-explicit targets, cross-source remote
// relationships, and permissions referencing the table directly via `_exists`;
// it cannot resolve bare foreign-key relationships or function return types,
// which then drop at reconcile as inconsistencies (see KNOWN_DIFFERENCES.md).
func (s *Store) loadUntrackDeps(ctx context.Context, argsJSON []byte) (*untrackDeps, error) {
	var a pgUntrackTableArgs
	if err := json.Unmarshal(argsJSON, &a); err != nil {
		// Defer the parse error to buildPgUntrackTable, which owns arg validation
		// and returns the Hasura-shaped message.
		return nil, nil //nolint:nilnil
	}

	if !a.Cascade {
		return nil, nil //nolint:nilnil
	}

	connStr := s.sourceDataURL(defaultIfEmpty(a.Source))
	if connStr == "" {
		return nil, nil //nolint:nilnil
	}

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		if s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"pg_untrack_table cascade: data database unreachable; "+
					"falling back to metadata-only cascade",
				"source", defaultIfEmpty(a.Source), "error", err,
			)
		}

		return nil, nil //nolint:nilnil
	}
	defer conn.Close(ctx)

	deps := &untrackDeps{
		fkByOwnerCols:        make(map[string]hasura.TableSource),
		funcsReturningTarget: make(map[string]struct{}),
	}

	if err := loadFKGraph(ctx, conn, deps); err != nil {
		return nil, err
	}

	if err := loadFuncReturnTargets(ctx, conn, deps, a.Table); err != nil {
		return nil, err
	}

	return deps, nil
}

// sourceDataURL resolves the connection string for the named source's data
// database from the current snapshot's connection_info, interpolating a
// from_env reference against the process environment. Returns "" when the
// source, its URL, or the referenced env var is absent.
func (s *Store) sourceDataURL(source string) string {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.hasura == nil {
		return ""
	}

	db := findDatabase(s.hasura, source)
	if db == nil {
		return ""
	}

	u := db.Configuration.ConnectionInfo.DatabaseURL
	if u.FromEnv != "" {
		if v, ok := os.LookupEnv(u.FromEnv); ok {
			return v
		}

		return ""
	}

	return u.URL
}

func loadFKGraph(ctx context.Context, q Queryer, deps *untrackDeps) error {
	rows, err := queryRows(ctx, q, suggestRelationshipsSQL)
	if err != nil {
		return fmt.Errorf("loading FK graph for cascade: %w", err)
	}
	defer rows.Close()

	fks, err := collectForeignKeys(rows)
	if err != nil {
		return fmt.Errorf("collecting FK graph for cascade: %w", err)
	}

	for _, fk := range fks {
		deps.fkByOwnerCols[fkOwnerKey(fk.from, fk.fromColumns)] = fk.to
	}

	return nil
}

func loadFuncReturnTargets(
	ctx context.Context, q Queryer, deps *untrackDeps, target hasura.TableSource,
) error {
	rows, err := queryRows(ctx, q, funcReturnTableSQL, target.Schema, target.Name)
	if err != nil {
		return fmt.Errorf("loading function return types for cascade: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var schema, name string
		if err := rows.Scan(&schema, &name); err != nil {
			return fmt.Errorf("scanning function return type: %w", err)
		}

		deps.funcsReturningTarget[funcKey(schema, name)] = struct{}{}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating function return types: %w", err)
	}

	return nil
}

// cascadeUntrack reproduces Hasura's pg_untrack_table cascade after the target
// table itself has been removed from its source. It drops, across the whole
// metadata, every object that depends on the table:
//
//   - remote relationships (any source) whose to_source targets the table,
//     together with the object/array relationship each lowers into on load;
//   - object/array relationships in the table's source that resolve to it
//     (manual_configuration, explicit foreign_key_constraint_on target, or a
//     bare foreign_key_constraint_on resolved through the introspected FK graph);
//   - functions in the table's source whose return type is the table;
//   - permissions whose row filter references the table, either directly via
//     `_exists` or through a relationship path that lands on it.
//
// deps may be nil (metadata-only cascade): bare-FK relationships and functions
// are then left in place. Those residual divergences are documented in
// KNOWN_DIFFERENCES.md.
func cascadeUntrack(
	h *hasura.Metadata, source string, target hasura.TableSource, deps *untrackDeps,
) {
	// Remote relationships first, across every source: drop the to_source entry
	// and the object/array relationship it lowered into, so it does not re-lower
	// on the next reload.
	for di := range h.Databases {
		db := &h.Databases[di]
		for ti := range db.Tables {
			t := &db.Tables[ti]
			for j := len(t.RemoteRelationships) - 1; j >= 0; j-- {
				if remoteRelTargets(t.RemoteRelationships[j], source, target) {
					name := t.RemoteRelationships[j].Name
					t.RemoteRelationships = removeAt(t.RemoteRelationships, j)
					removeLoweredRelationship(t, name)
				}
			}
		}
	}

	tdb := findDatabase(h, source)
	if tdb == nil {
		return
	}

	// Resolve every object/array relationship's target up front, before any
	// removal, so the permission-path walk (which follows relationship hops) sees
	// the full graph even after the reverse relationships are dropped.
	relTarget := buildRelTargetMap(tdb, deps)

	cascadeReverseRelationships(tdb, relTarget, target)
	cascadeFunctions(tdb, deps)
	cascadePermissions(tdb, relTarget, target)
}

// buildRelTargetMap maps each object/array relationship to its target table,
// keyed by relKey(owner, relName).
func buildRelTargetMap(
	tdb *hasura.DatabaseMetadata, deps *untrackDeps,
) map[string]hasura.TableSource {
	relTarget := make(map[string]hasura.TableSource)

	for ti := range tdb.Tables {
		t := &tdb.Tables[ti]

		for _, r := range t.ObjectRelationships {
			if tgt, ok := resolveRelTarget(r.Using, t.Table, deps); ok {
				relTarget[relKey(t.Table, r.Name)] = tgt
			}
		}

		for _, r := range t.ArrayRelationships {
			if tgt, ok := resolveRelTarget(r.Using, t.Table, deps); ok {
				relTarget[relKey(t.Table, r.Name)] = tgt
			}
		}
	}

	return relTarget
}

func cascadeReverseRelationships(
	tdb *hasura.DatabaseMetadata,
	relTarget map[string]hasura.TableSource,
	target hasura.TableSource,
) {
	for ti := range tdb.Tables {
		t := &tdb.Tables[ti]

		for j := len(t.ObjectRelationships) - 1; j >= 0; j-- {
			if tgt, ok := relTarget[relKey(t.Table, t.ObjectRelationships[j].Name)]; ok &&
				tableEquals(tgt, target) {
				t.ObjectRelationships = removeAt(t.ObjectRelationships, j)
			}
		}

		for j := len(t.ArrayRelationships) - 1; j >= 0; j-- {
			if tgt, ok := relTarget[relKey(t.Table, t.ArrayRelationships[j].Name)]; ok &&
				tableEquals(tgt, target) {
				t.ArrayRelationships = removeAt(t.ArrayRelationships, j)
			}
		}
	}
}

func cascadeFunctions(tdb *hasura.DatabaseMetadata, deps *untrackDeps) {
	if deps == nil || len(deps.funcsReturningTarget) == 0 {
		return
	}

	for j := len(tdb.Functions) - 1; j >= 0; j-- {
		f := tdb.Functions[j].Function
		if _, ok := deps.funcsReturningTarget[funcKey(f.Schema, f.Name)]; ok {
			tdb.Functions = removeAt(tdb.Functions, j)
		}
	}
}

func cascadePermissions(
	tdb *hasura.DatabaseMetadata,
	relTarget map[string]hasura.TableSource,
	target hasura.TableSource,
) {
	for ti := range tdb.Tables {
		t := &tdb.Tables[ti]
		owner := t.Table

		refs := func(expr hasura.PermissionExpression) bool {
			return permissionRefsTable(expr, owner, relTarget, target)
		}

		for j := len(t.SelectPermissions) - 1; j >= 0; j-- {
			if refs(t.SelectPermissions[j].Permission.Filter) {
				t.SelectPermissions = removeAt(t.SelectPermissions, j)
			}
		}

		for j := len(t.InsertPermissions) - 1; j >= 0; j-- {
			if refs(t.InsertPermissions[j].Permission.Check) {
				t.InsertPermissions = removeAt(t.InsertPermissions, j)
			}
		}

		for j := len(t.UpdatePermissions) - 1; j >= 0; j-- {
			p := t.UpdatePermissions[j].Permission
			if refs(p.Filter) || refs(p.Check) {
				t.UpdatePermissions = removeAt(t.UpdatePermissions, j)
			}
		}

		for j := len(t.DeletePermissions) - 1; j >= 0; j-- {
			if refs(t.DeletePermissions[j].Permission.Filter) {
				t.DeletePermissions = removeAt(t.DeletePermissions, j)
			}
		}
	}
}

// resolveRelTarget returns the table an object/array relationship points at.
//
// manual_configuration with a non-empty source is a lowered to_source remote
// relationship (handled via RemoteRelationships) and one with a remote_schema
// targets a GraphQL schema, not a table — both return ok=false here. A bare
// foreign_key_constraint_on (columns on the owner table) is resolved through the
// introspected FK graph in deps; without deps it cannot be resolved.
func resolveRelTarget(
	u hasura.RelationshipUsing, owner hasura.TableSource, deps *untrackDeps,
) (hasura.TableSource, bool) {
	if mc := u.ManualConfiguration; mc != nil {
		if mc.RemoteSchema != "" || mc.Source != "" || mc.RemoteTable.Name == "" {
			return hasura.TableSource{Schema: "", Name: "", Unknown: nil}, false
		}

		return mc.RemoteTable, true
	}

	if u.ForeignKeyConstraint != nil {
		return u.ForeignKeyConstraint.Table, true
	}

	if len(u.ForeignKeyColumns) > 0 && deps != nil {
		if t, ok := deps.fkByOwnerCols[fkOwnerKey(owner, u.ForeignKeyColumns)]; ok {
			return t, true
		}
	}

	return hasura.TableSource{Schema: "", Name: "", Unknown: nil}, false
}

// permissionRefsTable reports whether a Hasura boolean expression references
// target, starting from the table cur the permission is defined on. It follows
// relationship hops (resolving each through relTarget) and `_exists` sub-queries;
// reaching target through any path means the permission depends on the untracked
// table and Hasura drops it.
func permissionRefsTable(
	expr hasura.PermissionExpression,
	cur hasura.TableSource,
	relTarget map[string]hasura.TableSource,
	target hasura.TableSource,
) bool {
	for k, v := range expr {
		switch k {
		case "_and", "_or":
			if boolListRefsTable(v, cur, relTarget, target) {
				return true
			}
		case "_not":
			if m, ok := asExpr(v); ok && permissionRefsTable(m, cur, relTarget, target) {
				return true
			}
		case "_exists":
			if existsRefsTable(v, relTarget, target) {
				return true
			}
		default:
			// A key that names a relationship on cur is a hop into the related
			// table; anything else is a column leaf, which cannot reference
			// another table.
			tgt, ok := relTarget[relKey(cur, k)]
			if !ok {
				continue
			}

			if tableEquals(tgt, target) {
				return true
			}

			if m, ok := asExpr(v); ok && permissionRefsTable(m, tgt, relTarget, target) {
				return true
			}
		}
	}

	return false
}

func boolListRefsTable(
	v any,
	cur hasura.TableSource,
	relTarget map[string]hasura.TableSource,
	target hasura.TableSource,
) bool {
	switch vv := v.(type) {
	case []any:
		for _, e := range vv {
			if m, ok := asExpr(e); ok && permissionRefsTable(m, cur, relTarget, target) {
				return true
			}
		}
	case map[string]any:
		// Hasura also accepts a single bool expression (not wrapped in a list)
		// for _and/_or.
		return permissionRefsTable(vv, cur, relTarget, target)
	}

	return false
}

func existsRefsTable(
	v any, relTarget map[string]hasura.TableSource, target hasura.TableSource,
) bool {
	m, ok := asExpr(v)
	if !ok {
		return false
	}

	et := existsTable(m["_table"])
	if tableEquals(et, target) {
		return true
	}

	if w, ok := asExpr(m["_where"]); ok {
		return permissionRefsTable(w, et, relTarget, target)
	}

	return false
}

// remoteRelTargets reports whether r is a to_source remote relationship whose
// target is target in source. to_remote_schema relationships target a remote
// GraphQL schema and never match.
func remoteRelTargets(r hasura.RemoteRelationship, source string, target hasura.TableSource) bool {
	ts := r.Definition.ToSource
	if ts == nil {
		return false
	}

	return ts.Source == source && tableEquals(ts.Table, target)
}

// existsTable parses an `_exists._table` value ({"schema": ..., "name": ...}).
func existsTable(v any) hasura.TableSource {
	m, ok := v.(map[string]any)
	if !ok {
		return hasura.TableSource{Schema: "", Name: "", Unknown: nil}
	}

	schema, _ := m["schema"].(string)
	name, _ := m["name"].(string)

	return hasura.TableSource{Schema: schema, Name: name, Unknown: nil}
}

func asExpr(v any) (map[string]any, bool) {
	m, ok := v.(map[string]any)

	return m, ok
}

func tableEquals(a, b hasura.TableSource) bool {
	return a.Schema == b.Schema && a.Name == b.Name
}

func relKey(t hasura.TableSource, relName string) string {
	return t.Schema + "\x00" + t.Name + "\x00" + relName
}

func funcKey(schema, name string) string {
	return schema + "\x00" + name
}

// fkOwnerKey builds a column-order-independent key for a foreign key anchored on
// owner's columns, so a bare foreign_key_constraint_on (whose column order may
// differ from the catalog's) resolves regardless of ordering.
func fkOwnerKey(owner hasura.TableSource, cols []string) string {
	sorted := append([]string(nil), cols...)
	sort.Strings(sorted)

	return owner.Schema + "\x00" + owner.Name + "\x00" + strings.Join(sorted, ",")
}
