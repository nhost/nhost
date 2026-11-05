// Package permissions parses and applies per-role row-level permissions
// and column presets for SQL tables. It owns the rules for:
//
//   - normalising a raw metadata permission filter (column rename SQL → GraphQL,
//     session-variable lowercasing, _exists rewrite, nested logical operators);
//   - storing per-role select/insert/update/delete WHERE clauses and presets;
//   - emitting the row-level select-permission predicate with session-variable
//     substitution;
//   - helping insert-mutation CTE builders locate permission-referenced
//     columns that aren't in the user's insert payload, and detecting when an
//     insert check requires post-mutation evaluation (generated columns, or
//     DB-defaulted columns absent from the payload).
//
// The package depends on queries/where for filter parsing and queries/core
// for the Column type. It does not emit any insert/update/delete-specific
// SQL — those CTE-building helpers stay in the parent queries package and
// call into permissions.Store for the permission-specific bits.
//
// Runtime model: session-variable resolution is two-phase. Initialize stores
// the raw "x-hasura-*" marker strings inside each where.Clause; substitution
// against the request's session variables happens later, inside the Write*
// methods, after clause.WriteCondition has populated the SQL params slice.
package permissions

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// ErrSessionVariableNotFound is returned by SubstituteSessionVariable when a
// permission filter references a session variable that the caller did not
// provide. Callers wrap it for context.
var ErrSessionVariableNotFound = errors.New("session variable not found")

var (
	errColumnOrRelationshipNotFound   = errors.New("column or relationship not found in table")
	errExpectedListForLogicalOp       = errors.New("expected list for logical operator")
	errExpectedMapInListForLogicalOp  = errors.New("expected map in list for logical operator")
	errExpectedMapForNotOp            = errors.New("expected map for _not operator")
	errExpectedMapForRelationshipPerm = errors.New("expected map for relationship permission")
	errRelationshipNoLocalTargetTable = errors.New("has no local target table")
	errExpectedMapForExistsOp         = errors.New("expected map for _exists operator")
	errExpectedTableMapInExistsOp     = errors.New(
		"expected _table string or map in _exists operator",
	)
	errExpectedSchemaStringInExistsOp = errors.New(
		"expected string for _table.schema in _exists operator",
	)
	errExpectedNameStringInExistsOp = errors.New(
		"expected string for _table.name in _exists operator",
	)
	errExpectedWhereMapInExistsOp = errors.New("expected _where map in _exists operator")
	errTableNotFoundForExistsOp   = errors.New("table not found for _exists operator")
)

//go:generate mockgen -package mock -destination mock/permissions.go . Table,Relationship

// Table is the contract the permissions package needs from a parent-package
// table value. It exposes column/relationship lookup, sibling-table lookup
// for _exists, and a delegate to the parent's where parser.
type Table interface {
	// Name returns the SQL table name; used only in error messages.
	Name() string

	// ColumnFromSQLName resolves a SQL column name to its core.Column.
	// Returns nil when no column matches.
	ColumnFromSQLName(name string) *core.Column

	// ColumnFromGraphqlName distinguishes custom GraphQL aliases from physical SQL names.
	ColumnFromGraphqlName(name string) *core.Column

	// ComputedScalarFromGraphqlName resolves an executable predicate by its
	// metadata name. Permission filters are parsed with admin lookup, separately
	// from the user's select grants and GraphQL input visibility.
	ComputedScalarFromGraphqlName(name, role string) core.ComputedExpression

	// ComputedTableFromGraphqlName identifies a table predicate independently of grants.
	ComputedTableFromGraphqlName(name, role string) core.ComputedTableExpression

	// LookupRelationship resolves a GraphQL field name to its relationship;
	// returns a nil interface (not typed-nil) when no relationship matches.
	//
	// Named differently from where.Table.RelationshipFromGraphqlName and
	// arguments.Table.Relationship so a single *table can satisfy all three
	// interfaces — Go doesn't allow covariant return types.
	LookupRelationship(name string) Relationship

	// SiblingTable resolves a (schema, name) pair to a sibling table, used by
	// the _exists operator. Returns a nil interface when not found.
	//
	// Named differently from where.Table.TableBySchemaName for the same
	// covariant-return reason as LookupRelationship above.
	SiblingTable(schema, name string) Table

	// ParseWhere parses a normalised permission filter into a where.Clause.
	// Implementations should delegate to where.Parse with themselves (as
	// where.Table) and PermissionAliases for permission filters.
	//
	// Calling convention from this package: parsePermissionFilter is the sole
	// call site and always invokes
	//
	//   t.ParseWhere(v, nil, metadata.RoleAdmin, permission template, 0, where.PermissionAliases)
	//
	// The wide signature exists so a single *table value can satisfy both
	// permissions.Table and arguments.Table (whose call sites do exercise
	// variables/role/sessionVariables/nestingLevel). The interface is
	// deliberately not segregated to keep one adapter method per *table; the
	// always-default arguments here are not a contract the permissions package
	// itself relies on at runtime.
	ParseWhere(
		whereArg *ast.Value,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
		nestingLevel int,
		aliases where.Aliases,
	) (where.Clause, error)
}

// Relationship is the contract the permissions package needs from a parent-
// package relationship value. The package only walks into the target table to
// recursively normalise filters; it does not emit join SQL.
type Relationship interface {
	// Name returns the relationship's GraphQL name. After normalisation, the
	// permission filter uses this name to address the relationship.
	Name() string

	// LookupTarget returns the relationship's target Table. Returns a nil
	// interface for remote/remote-schema relationships that have no local
	// target.
	//
	// Named differently from where.Relationship.Target and
	// arguments.Relationship.TargetTable so a single *relationship can
	// satisfy all three contracts — Go doesn't allow covariant returns.
	LookupTarget() Table
}

// Store holds per-role permission state for a single table.
//
// Maps are keyed by role name. A missing key means "no permission of this kind
// for this role"; for select, this is also distinct from "empty clause grants
// access without row-level filtering" because the upstream metadata uses an
// empty filter to express "any row".
//
// Construction contract: always build a Store via NewStore. Initialize is the
// only intended writer of these maps in production — the fields are exported
// solely so the parent-package white-box tests (queries package) can inject
// canned clauses without running the full Initialize pipeline. External
// readers should treat the maps as read-only; mutation outside Initialize
// bypasses the normalisation step and is a deliberate test seam, not a
// supported extension point.
type Store struct {
	Select map[string]where.Clause
	Insert map[string]where.Clause
	Update map[string]where.Clause
	Delete map[string]where.Clause

	// UpdateCheck holds the post-update "check" predicate for each role. Unlike
	// Update (the row filter selecting which rows are visible for update),
	// UpdateCheck validates the row state *after* the UPDATE is applied — it is
	// the update analogue of Insert. An update producing a row that fails this
	// predicate aborts the whole mutation (all-or-nothing). A missing key, or a
	// key mapping to an empty clause (Hasura's `check: {}` / `check: null`),
	// means "no post-update constraint".
	UpdateCheck map[string]where.Clause

	// InsertPresets and UpdatePresets are role -> sql_column -> preset value.
	// Values may be literal Go values or "x-hasura-*" session-variable markers
	// (already lowercased by normalizePresets).
	InsertPresets map[string]map[string]any
	UpdatePresets map[string]map[string]any
}

// NewStore returns an empty Store with all maps initialised. This is the only
// supported way to construct a Store: building a Store{} literal compiles but
// will panic on the first map write because the maps stay nil. All Initialize
// and Write* paths rely on the maps being non-nil.
func NewStore() *Store {
	return &Store{
		Select:        make(map[string]where.Clause),
		Insert:        make(map[string]where.Clause),
		Update:        make(map[string]where.Clause),
		Delete:        make(map[string]where.Clause),
		UpdateCheck:   make(map[string]where.Clause),
		InsertPresets: make(map[string]map[string]any),
		UpdatePresets: make(map[string]map[string]any),
	}
}

// Initialize parses the select/insert/update/delete permissions and presets
// declared in md and stores them in s, keyed by role. It runs after table
// columns and relationships are already in place on t — the normaliser walks
// them when rewriting SQL column names and recursing into relationships.
// Computed scalars must be initialized on ALL sibling tables first: a filter
// can reach a later table through a relationship, _exists or an aggregate.
//
// Each per-role entry: normalise → AST → parse into where.Clause via
// parsePermissionFilter. The two-step metadata-to-AST round-trip lets the
// existing where parser handle filters without duplicating its operator
// dispatch here.
//
// Partial-failure contract: Initialize processes kinds in fixed order (select,
// insert, update, delete) and returns the first error. There is no rollback
// — on error, s may be left populated with whatever ran before the failure.
// Callers should treat s as undefined unless Initialize returned nil; the only
// production caller (queries/permissions_adapter.go) calls Initialize against
// a freshly-built Store and never reuses one after an error.
func Initialize(t Table, s *Store, md metadata.TableMetadata) error {
	for _, perm := range md.SelectPermissions {
		clause, err := parsePermissionFilter(t, perm.Role, perm.Permission.Filter, "select")
		if err != nil {
			return err
		}

		s.Select[perm.Role] = clause
	}

	for _, perm := range md.InsertPermissions {
		clause, err := parsePermissionFilter(t, perm.Role, perm.Permission.Check, "insert")
		if err != nil {
			return err
		}

		s.Insert[perm.Role] = clause

		if len(perm.Permission.Set) > 0 {
			s.InsertPresets[perm.Role] = normalizePresets(perm.Permission.Set)
		}
	}

	for _, perm := range md.UpdatePermissions {
		clause, err := parsePermissionFilter(t, perm.Role, perm.Permission.Filter, "update")
		if err != nil {
			return err
		}

		s.Update[perm.Role] = clause

		check, err := parsePermissionFilter(t, perm.Role, perm.Permission.Check, "update")
		if err != nil {
			return err
		}

		s.UpdateCheck[perm.Role] = check

		if len(perm.Permission.Set) > 0 {
			s.UpdatePresets[perm.Role] = normalizePresets(perm.Permission.Set)
		}
	}

	for _, perm := range md.DeletePermissions {
		clause, err := parsePermissionFilter(t, perm.Role, perm.Permission.Filter, "delete")
		if err != nil {
			return err
		}

		s.Delete[perm.Role] = clause
	}

	return nil
}

// parsePermissionFilter runs the shared three-step pipeline used by Initialize
// for each permission kind: fixColumns (normalise SQL→GraphQL names, recurse
// into relationships, lowercase session-variable markers), GoValueToAST
// (round-trip the Go map through gqlparser's AST), then Table.ParseWhere
// (delegate to the queries/where parser with PermissionAliases).
//
// kind is one of "select"|"insert"|"update"|"delete" and appears in wrapped
// error messages so callers can identify which permission failed for which
// role.
func parsePermissionFilter(
	t Table, role string, filter map[string]any, kind string,
) (where.Clause, error) {
	fixed, err := fixColumns(t, filter)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to fix %s permission columns for role %s: %w", kind, role, err,
		)
	}

	v, err := values.GoValueToAST(fixed)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to convert %s permission filter to AST for role %s: %w", kind, role, err,
		)
	}

	clause, err := t.ParseWhere(
		v,
		nil,
		metadata.RoleAdmin,
		map[string]any{core.PermissionSessionTemplateKey: true},
		0,
		where.PermissionAliases,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to parse %s permission filter for role %s: %w", kind, role, err,
		)
	}

	return clause, nil
}

// isLogicalConnective is the closed set of conjunction-style operators that
// take a list of sub-filters and recurse.
func isLogicalConnective(key string) bool {
	switch key {
	case "_and", "_or", "$and", "$or":
		return true
	}

	return false
}

// isComparisonOperator is the closed set of leaf comparison operators that
// take a single value (and only need x-hasura-* lowercasing for that value).
func isComparisonOperator(key string) bool {
	switch key {
	case "_eq", "_neq", "_ne", "_gt", "_lt", "_gte", "_lte", "_like", "_nlike",
		"_ilike", "_nilike", "_similar", "_nsimilar", "_regex", "_nregex", "_iregex", "_niregex",
		"_in", "_nin", "_is_null", "_contains", "_contained_in", "_has_key", "_has_keys_any",
		"_has_keys_all", "_cast", "_ceq", "_cne", "_cneq", "_cgt", "_clt", "_cgte", "_clte",
		"_ancestor", "_ancestor_any", "_descendant", "_descendant_any", "_matches",
		"_matches_any", "_matches_fulltext", "_st_contains", "_st_crosses", "_st_equals",
		"_st_overlaps", "_st_touches", "_st_within", "_st_intersects", "_st_3d_intersects",
		"_st_d_within", "_st_3d_d_within":
		return true
	}

	return false
}

// fixColumns rewrites a raw metadata permission filter so the where parser
// can consume it: SQL column names are renamed to GraphQL names, logical
// operators (_and/_or/_not) recurse, _exists is resolved against the sibling
// table, and "x-hasura-*" session-variable values are lowercased.
//
// Unknown columns or relationships at any level are reported with the SQL
// table name for context. The dispatch table here is the single place where
// each permission-filter shape is recognised; per-shape rewriting lives in
// the fixLogical/fixNot/fixExists/fixComparison/fixColumnKey/fixRelationship
// helpers so each shape's type checks stay co-located with its logic.
func fixColumns(t Table, permissions map[string]any) (map[string]any, error) {
	return fixColumnsRoot(t, t, permissions)
}

func fixColumnsRoot(t, root Table, permissions map[string]any) (map[string]any, error) {
	fixed := make(map[string]any, len(permissions))

	for key, value := range permissions {
		out, err := fixEntry(t, root, key, value)
		if err != nil {
			return nil, err
		}

		fixed[out.key] = out.value
	}

	return fixed, nil
}

// fixedEntry is one key/value pair after normalisation. Keep distinct logical
// aliases as distinct keys: Hasura ANDs every bool-exp entry, even when both
// _and and $and (or another alias pair) occur in the same object.
type fixedEntry struct {
	key   string
	value any
}

func fixEntry(t, root Table, key string, value any) (fixedEntry, error) {
	if isLogicalConnective(key) {
		entry, err := fixLogical(t, root, key, value)
		return entry, err
	}

	switch key {
	case "_not", "$not":
		return fixNot(t, root, key, value)
	case "_exists", "$exists":
		return fixExistsEntry(t, root, key, value)
	}

	if isComparisonOperator(key) ||
		strings.HasPrefix(key, "$") && isComparisonOperator("_"+key[1:]) {
		return fixComparison(key, value), nil
	}

	if column := t.ColumnFromSQLName(key); column != nil {
		return fixedEntry{
			key:   column.GraphqlName,
			value: fixColumnComparisonValues(t, root, value),
		}, nil
	}

	if t.ComputedScalarFromGraphqlName(key, metadata.RoleAdmin) != nil {
		return fixedEntry{key: key, value: fixColumnComparisonValues(t, root, value)}, nil
	}

	if computed := t.ComputedTableFromGraphqlName(key, metadata.RoleAdmin); computed != nil {
		return fixComputedTable(t, root, key, value, computed)
	}

	if rel := t.LookupRelationship(key); rel != nil {
		return fixRelationship(rel, root, value)
	}

	return fixedEntry{}, fmt.Errorf(
		"%w: %s not found in table %s", errColumnOrRelationshipNotFound, key, t.Name(),
	)
}

func fixComputedTable(t, root Table, key string, value any,
	computed core.ComputedTableExpression,
) (fixedEntry, error) {
	target := t.SiblingTable(computed.TargetSchema(), computed.TargetName())
	if target == nil {
		return fixedEntry{}, fmt.Errorf("%w: computed target %s.%s",
			errColumnOrRelationshipNotFound, computed.TargetSchema(), computed.TargetName())
	}

	comparison, ok := value.(map[string]any)
	if !ok {
		return fixedEntry{}, fmt.Errorf("%w: computed table %s",
			errExpectedMapForRelationshipPerm, key)
	}

	fixed, err := fixColumnsRoot(target, root, comparison)
	if err != nil {
		return fixedEntry{}, fmt.Errorf("fixing computed table %s: %w", key, err)
	}

	return fixedEntry{key: key, value: fixed}, nil
}

// fixLogical rewrites a top-level "_and" or "_or" entry. Both share the
// "list of sub-filter maps" shape, so they go through the same helper.
func fixLogical(t, root Table, key string, value any) (fixedEntry, error) {
	list, ok := value.([]any)
	if !ok {
		return fixedEntry{}, fmt.Errorf("%w: %s", errExpectedListForLogicalOp, key)
	}

	fixedList := make([]any, len(list))

	for i, item := range list {
		itemMap, ok := item.(map[string]any)
		if !ok {
			return fixedEntry{}, fmt.Errorf(
				"%w: %s", errExpectedMapInListForLogicalOp, key,
			)
		}

		fixedItem, err := fixColumnsRoot(t, root, itemMap)
		if err != nil {
			return fixedEntry{}, fmt.Errorf(
				"failed to fix permission columns for logical operator %s: %w", key, err,
			)
		}

		fixedList[i] = fixedItem
	}

	return fixedEntry{key: key, value: fixedList}, nil
}

func fixNot(t, root Table, key string, value any) (fixedEntry, error) {
	notMap, ok := value.(map[string]any)
	if !ok {
		return fixedEntry{}, errExpectedMapForNotOp
	}

	fixedNot, err := fixColumnsRoot(t, root, notMap)
	if err != nil {
		return fixedEntry{}, fmt.Errorf("failed to fix permission columns for _not: %w", err)
	}

	return fixedEntry{key: key, value: fixedNot}, nil
}

func fixExistsEntry(t, root Table, key string, value any) (fixedEntry, error) {
	fixedExists, err := fixExistsRoot(t, root, value)
	if err != nil {
		return fixedEntry{}, fmt.Errorf("failed to fix _exists permission columns: %w", err)
	}

	return fixedEntry{key: key, value: fixedExists}, nil
}

// fixComparison handles "_eq"/"_neq"/etc. at the top level: lowercase any
// "x-hasura-*" RHS string, otherwise pass the value through unchanged.
func fixComparison(op string, value any) fixedEntry {
	if s, ok := value.(string); ok && strings.HasPrefix(strings.ToLower(s), "x-hasura-") {
		return fixedEntry{key: op, value: strings.ToLower(s)}
	}

	return fixedEntry{key: op, value: value}
}

func fixRelationship(rel Relationship, root Table, value any) (fixedEntry, error) {
	relPerms, ok := value.(map[string]any)
	if !ok {
		return fixedEntry{}, fmt.Errorf(
			"%w %s", errExpectedMapForRelationshipPerm, rel.Name(),
		)
	}

	target := rel.LookupTarget()
	if target == nil {
		return fixedEntry{}, fmt.Errorf(
			"relationship %s %w", rel.Name(), errRelationshipNoLocalTargetTable,
		)
	}

	fixedRel, err := fixColumnsRoot(target, root, relPerms)
	if err != nil {
		return fixedEntry{}, fmt.Errorf(
			"failed to fix permission columns for relationship %s: %w", rel.Name(), err,
		)
	}

	return fixedEntry{key: rel.Name(), value: fixedRel}, nil
}

// Column comparison operands are identifiers, not session values. Map SQL
// column names to their GraphQL names on the appropriate table before parsing.
// Invalid paths are left untouched for the where parser to reject.
func fixColumnComparisonValues(t, root Table, value any) any {
	comparison, ok := value.(map[string]any)
	if !ok {
		return map[string]any{"_eq": fixValue(value)}
	}

	fixed := make(map[string]any, len(comparison))
	for op, rhs := range comparison {
		switch "_" + strings.TrimLeft(op, "_$") {
		case "_ceq", "_cne", "_cneq", "_cgt", "_clt", "_cgte", "_clte":
			fixed[op] = fixColumnReferenceValue(t, root, rhs)
		case "_cast":
			fixed[op] = fixComputedCastColumns(t, root, rhs)
		default:
			fixed[op] = fixValue(rhs)
		}
	}

	return fixed
}

func fixComputedCastColumns(t, root Table, value any) any {
	cast, ok := value.(map[string]any)
	if !ok {
		return fixValue(value)
	}

	fixed := make(map[string]any, len(cast))
	for name, child := range cast {
		fixed[name] = fixColumnComparisonValues(t, root, child)
	}

	return fixed
}

const rootColumnPathLength = 2

func fixColumnReferenceValue(t, root Table, rhs any) any {
	name, found := rhs.(string)

	table := t
	if path, ok := rhs.([]any); ok {
		switch len(path) {
		case 1:
			name, found = path[0].(string)
		case rootColumnPathLength:
			if marker, ok := path[0].(string); ok && marker == "$" {
				name, found = path[1].(string)
				table = root
			}
		}
	}

	if !found || table == nil {
		return rhs
	}

	col := table.ColumnFromSQLName(name)
	if col == nil {
		// A GraphQL custom name is valid in user where inputs, but Hasura's
		// permission column-comparison RHS accepts physical SQL names only.
		// Reject it instead of letting the where parser resolve that alias.
		if table.ColumnFromGraphqlName(name) != nil {
			return map[string]any{"invalid_column": name}
		}

		return rhs
	}

	if path, ok := rhs.([]any); ok {
		copyPath := append([]any(nil), path...)
		copyPath[len(copyPath)-1] = col.GraphqlName

		return copyPath
	}

	return col.GraphqlName
}

// fixValue lowercases any string starting with "x-hasura-" anywhere inside v,
// recursing through maps and slices. Returns copies of maps and slices;
// scalars are returned unchanged.
func fixValue(value any) any {
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, val := range v {
			out[key] = fixValue(val)
		}

		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = fixValue(item)
		}

		return out
	case string:
		if strings.HasPrefix(strings.ToLower(v), "x-hasura-") {
			return strings.ToLower(v)
		}
	}

	return value
}

// fixExists rewrites the _where payload of an _exists operator against the
// resolved sibling table. Bare names and omitted/null schemas resolve to public.
// The _table reference is normalized to an explicit schema/name pair so the
// where parser resolves the same table.
func fixExists(t Table, value any) (map[string]any, error) {
	return fixExistsRoot(t, t, value)
}

func fixExistsRoot(t, root Table, value any) (map[string]any, error) {
	existsMap, ok := value.(map[string]any)
	if !ok {
		return nil, errExpectedMapForExistsOp
	}

	var schema, name string
	switch ref := existsMap["_table"].(type) {
	case string:
		schema, name = "public", ref
	case map[string]any:
		schema = "public"
		if rawSchema, exists := ref["schema"]; exists && rawSchema != nil {
			var ok bool

			schema, ok = rawSchema.(string)
			if !ok {
				return nil, errExpectedSchemaStringInExistsOp
			}
		}

		var ok bool

		name, ok = ref["name"].(string)
		if !ok {
			return nil, errExpectedNameStringInExistsOp
		}
	default:
		return nil, errExpectedTableMapInExistsOp
	}

	if name == "" {
		return nil, errExpectedNameStringInExistsOp
	}

	whereMap, ok := existsMap["_where"].(map[string]any)
	if !ok {
		return nil, errExpectedWhereMapInExistsOp
	}

	target := t.SiblingTable(schema, name)
	if target == nil {
		return nil, fmt.Errorf("%w: %s.%s", errTableNotFoundForExistsOp, schema, name)
	}

	fixedWhere, err := fixColumnsRoot(target, root, whereMap)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to fix _exists _where columns for %s.%s: %w",
			schema,
			name,
			err,
		)
	}

	return map[string]any{
		"_table": map[string]any{"schema": schema, "name": name},
		"_where": fixedWhere,
	}, nil
}

// normalizePresets lowercases "x-hasura-*" values in a preset map so they
// match the lowercased session-variable keys produced by middleware. Column
// names are left as-is (they're already SQL names from metadata).
func normalizePresets(presets map[string]any) map[string]any {
	normalized := make(map[string]any, len(presets))

	for colName, value := range presets {
		if s, ok := value.(string); ok && strings.HasPrefix(strings.ToLower(s), "x-hasura-") {
			value = strings.ToLower(s)
		}

		normalized[colName] = value
	}

	return normalized
}

// SubstituteSessionVariable resolves a single permission-filter parameter:
// "x-hasura-*" strings are replaced with the matching value from
// sessionVariables; slice values recurse element-wise into a copied slice so
// shared permission metadata is not mutated by one request/subscription build.
// As a special case, a single-element slice whose lone element is a
// session-variable marker that resolves to a non-slice value is flattened to
// that scalar — this preserves the semantics of
// `column _eq x-hasura-user-id` against a scalar variable. Multi-element
// slices (e.g. `_in: ["x-hasura-user-id", "alice"]`) keep every element so
// literals mixed with session-var markers are not dropped.
//
// Returns ErrSessionVariableNotFound (wrapped) when the variable name is not
// present in sessionVariables.
func SubstituteSessionVariable(v any, sessionVariables map[string]any) (any, error) {
	switch v := v.(type) {
	case string:
		if strings.HasPrefix(strings.ToLower(v), "x-hasura-") {
			if val, found := sessionVariables[v]; found {
				return val, nil
			}

			return nil, fmt.Errorf("%w: %s", ErrSessionVariableNotFound, v)
		}
	case []any:
		if v == nil {
			return v, nil
		}

		out := make([]any, len(v))
		for i, item := range v {
			substituted, err := SubstituteSessionVariable(item, sessionVariables)
			if err != nil {
				return nil, err
			}

			// Flatten only when the slice has exactly one element AND that
			// element was a session-variable marker that resolved to a
			// non-slice value. Checking the marker shape (rather than
			// interface inequality) avoids panics on uncomparable nested
			// []any elements and prevents silent literal-drop on
			// multi-element mixed slices.
			if len(v) == 1 {
				if s, ok := item.(string); ok &&
					strings.HasPrefix(strings.ToLower(s), "x-hasura-") {
					if _, isSlice := substituted.([]any); !isSlice {
						return substituted, nil
					}
				}
			}

			out[i] = substituted
		}

		return out, nil
	case []string:
		return substituteStringArray(v, sessionVariables)
	case core.FunctionSessionArgument:
		return substituteFunctionSessionArgument(v, sessionVariables)
	}

	return v, nil
}

func substituteFunctionSessionArgument(
	marker core.FunctionSessionArgument, sessionVariables map[string]any,
) (any, error) {
	// A multiplexed cohort supplies typed per-subscriber values. Leave the
	// whole-session marker for Multiplex to rewrite to result_vars->'session'.
	for _, session := range sessionVariables {
		if _, template := session.(core.SessionVarValue); template {
			return marker, nil
		}
	}

	if sessionVariables == nil {
		sessionVariables = map[string]any{}
	}

	encoded, err := json.Marshal(sessionVariables, json.Deterministic(true))
	if err != nil {
		return nil, fmt.Errorf("serializing computed permission session: %w", err)
	}

	return string(encoded), nil
}

// substituteStringArray resolves session-variable references inside the
// []string produced by the JSONB key operators (_has_keys_all / _has_keys_any).
// A single whole-array session variable (e.g. `_has_keys_any: X-Hasura-Keys`)
// flattens to the resolved value — a SessionVarValue marker on the subscription
// template path, or the concrete session value on the direct path — mirroring
// the []any (_in) handling. When any element is a session variable the slice
// widens to []any so it can carry a marker alongside literal keys; a slice of
// plain literals is returned unchanged so ordinary JSONB keys keep their type.
// Only permission metadata is fed through here, so a user-supplied look-alike
// literal such as ["x-hasura-foo"] is never reinterpreted as a session variable.
func substituteStringArray(v []string, sessionVariables map[string]any) (any, error) {
	hasSessionVar := false

	for _, item := range v {
		if strings.HasPrefix(strings.ToLower(item), "x-hasura-") {
			hasSessionVar = true

			break
		}
	}

	if !hasSessionVar {
		return v, nil
	}

	out := make([]any, len(v))

	for i, item := range v {
		substituted, err := SubstituteSessionVariable(item, sessionVariables)
		if err != nil {
			return nil, err
		}

		// Flatten a single whole-array session variable to its resolved value
		// (marker or concrete value), matching the []any scalar flatten.
		if len(v) == 1 {
			if _, isSlice := substituted.([]any); !isSlice {
				return substituted, nil
			}
		}

		out[i] = substituted
	}

	return out, nil
}

// substituteSessionVariables resolves session-variable markers in params[start:]
// in place, leaving params[:start] untouched. Callers pass start = len(params)
// captured *before* the permission clause appended its own parameters, so only
// the permission clause's values are substituted — never the user-supplied
// where/_set/_in/by_pk literals that precede them in the slice. A user literal
// that happens to begin with "x-hasura-" must stay verbatim (it is data, not a
// session-variable reference), matching Hasura; only the permission metadata is
// a legitimate source of session-variable markers.
//
// Returns the (now-mutated) params slice so callers can use a single =
// assignment instead of a separate error check + reassignment.
func substituteSessionVariables(
	params []any, sessionVariables map[string]any, start int,
) ([]any, error) {
	for i := start; i < len(params); i++ {
		substituted, err := SubstituteSessionVariable(params[i], sessionVariables)
		if err != nil {
			return nil, err
		}

		params[i] = substituted
	}

	return params, nil
}

// HasRowLevel reports whether role has a non-empty row-level select filter.
// An empty clause is treated as "no row-level filter" — consistent with how
// the metadata expresses unrestricted access.
func (s *Store) HasRowLevel(role string) bool {
	perms, found := s.Select[role]
	return found && len(perms) > 0
}

// HasInsertCheck reports whether role has any insert-check permission entry.
// The presence of an entry — even an empty one — distinguishes "role may
// insert" from "role has no insert permission at all".
func (s *Store) HasInsertCheck(role string) bool {
	_, found := s.Insert[role]
	return found
}

// HasNonEmptyInsertCheck reports whether role has a non-empty insert-check
// predicate. An empty clause (Hasura's `check: {}` / `check: null`) is treated
// as "no insert constraint" because WriteInsertCheckSubstituted writes "true"
// and reports hasCheck=false for it, so no all-or-nothing CTE is emitted.
// Callers use this to decide whether an upsert must route through the
// post-mutation check path so the insert check is scoped to inserted rows;
// mirrors HasUpdateCheck.
func (s *Store) HasNonEmptyInsertCheck(role string) bool {
	clause, found := s.Insert[role]
	return found && len(clause) > 0
}

// HasUpdateFilter reports whether role has a non-empty update row filter.
// An empty clause is treated as "no row-level filter" because callers wrap
// emitted predicates in AND (...), and an empty clause would produce invalid SQL.
func (s *Store) HasUpdateFilter(role string) bool {
	clause, found := s.Update[role]
	return found && len(clause) > 0
}

// HasUpdateCheck reports whether role has a non-empty post-update check
// predicate. An empty clause (Hasura's `check: {}` / `check: null`) is treated
// as "no post-update constraint" so callers can skip the post-mutation CTE and
// avoid emitting an empty WHERE.
func (s *Store) HasUpdateCheck(role string) bool {
	clause, found := s.UpdateCheck[role]
	return found && len(clause) > 0
}

// HasDeleteFilter reports whether role has a non-empty delete row filter.
// An empty clause is treated as "no row-level filter" for the same reason as
// HasUpdateFilter.
func (s *Store) HasDeleteFilter(role string) bool {
	clause, found := s.Delete[role]
	return found && len(clause) > 0
}

// WriteRowLevel emits the row-level select-permission predicate for role,
// qualifying columns with sourceRef and substituting session variables in the
// collected params. Returns the original params and paramIndex unchanged when
// role has no select filter.
func (s *Store) WriteRowLevel(
	b *strings.Builder,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) ([]any, int, error) {
	clause, found := s.Select[role]
	if !found {
		return params, paramIndex, nil
	}

	startLen := len(params)

	params, paramIndex, err := clause.WriteCondition(b, sourceRef, params, paramIndex)
	if err != nil {
		return nil, 0, fmt.Errorf("writing row-level permission clause: %w", err)
	}

	params, err = substituteSessionVariables(params, sessionVariables, startLen)
	if err != nil {
		return nil, 0, err
	}

	return params, paramIndex, nil
}

// WriteInsertCheckSubstituted emits the insert-check permission predicate for
// role. hasCheck reports whether any predicate was written: when role has no
// insert permission, WriteInsertCheckSubstituted writes "true" and returns
// hasCheck=false so callers can elide downstream all-or-nothing CTEs.
//
// sourceRef is the alias for the data subquery the predicate runs against
// (typically the "data" CTE alias for pre-mutation checks, or the
// "_mutation_result" / "_<nested_cte>" CTE for post-mutation checks).
//
// subs redirects relationship-EXISTS subqueries that target a sibling table
// currently being inserted into in the same CTE chain to its in-flight CTE.
// This is required by Postgres' WITH snapshot semantics: a sibling CTE
// doesn't see in-flight INSERTs in the same statement, so an EXISTS against
// the underlying table reads stale state. Passing TableSubstitutions like
// {`"public"."workout_sessions"`: `mutation_result`} redirects those EXISTS
// subqueries to the parent CTE that holds the freshly inserted rows. With a
// nil or empty map, behaviour is identical to a non-substituted render —
// top-level callers pass nil.
func (s *Store) WriteInsertCheckSubstituted(
	b *strings.Builder,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
	sourceRef string,
	subs where.TableSubstitutions,
) ([]any, int, bool, error) {
	clause, found := s.Insert[role]
	if !found || len(clause) == 0 {
		b.WriteString("true")
		return params, paramIndex, false, nil
	}

	startLen := len(params)

	params, paramIndex, err := where.WriteConditionSubstituted(
		clause, b, sourceRef, params, paramIndex, subs,
	)
	if err != nil {
		return nil, 0, false, fmt.Errorf("failed to apply insert permission check: %w", err)
	}

	params, err = substituteSessionVariables(params, sessionVariables, startLen)
	if err != nil {
		return nil, 0, false, err
	}

	return params, paramIndex, true, nil
}

// WriteUpdateFilter emits the update-permission row filter for role with
// session-variable substitution; same shape as WriteRowLevel but reads the
// Update map. Returns hasFilter=false when role has no update permission so
// callers can skip the WHERE entirely.
func (s *Store) WriteUpdateFilter(
	b *strings.Builder,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) ([]any, int, bool, error) {
	clause, found := s.Update[role]
	if !found {
		return params, paramIndex, false, nil
	}

	startLen := len(params)

	params, paramIndex, err := clause.WriteCondition(b, sourceRef, params, paramIndex)
	if err != nil {
		return nil, 0, false, fmt.Errorf("writing update permission clause: %w", err)
	}

	params, err = substituteSessionVariables(params, sessionVariables, startLen)
	if err != nil {
		return nil, 0, false, err
	}

	return params, paramIndex, true, nil
}

// WriteUpdateCheck emits the post-update check predicate for role against
// sourceRef (the CTE holding the UPDATE's RETURNING * rows). It is the update
// analogue of WriteInsertCheckSubstituted's post-mutation path: the predicate
// is rendered so the caller can assert every updated row satisfies it.
//
// hasCheck reports whether a predicate was written. When role has no check, or
// only an empty clause, WriteUpdateCheck writes "true" and returns
// hasCheck=false so callers can elide the all-or-nothing CTE. Mirrors
// WriteInsertCheckSubstituted so both mutation paths share the same shape.
func (s *Store) WriteUpdateCheck(
	b *strings.Builder,
	role string,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
	sourceRef string,
) ([]any, int, bool, error) {
	clause, found := s.UpdateCheck[role]
	if !found || len(clause) == 0 {
		b.WriteString("true")
		return params, paramIndex, false, nil
	}

	startLen := len(params)

	params, paramIndex, err := clause.WriteCondition(b, sourceRef, params, paramIndex)
	if err != nil {
		return nil, 0, false, fmt.Errorf("failed to apply update permission check: %w", err)
	}

	params, err = substituteSessionVariables(params, sessionVariables, startLen)
	if err != nil {
		return nil, 0, false, err
	}

	return params, paramIndex, true, nil
}

// WriteDeleteFilter emits the delete-permission row filter for role; same
// shape as WriteUpdateFilter against the Delete map.
func (s *Store) WriteDeleteFilter(
	b *strings.Builder,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) ([]any, int, bool, error) {
	clause, found := s.Delete[role]
	if !found {
		return params, paramIndex, false, nil
	}

	startLen := len(params)

	params, paramIndex, err := clause.WriteCondition(b, sourceRef, params, paramIndex)
	if err != nil {
		return nil, 0, false, fmt.Errorf("writing delete permission clause: %w", err)
	}

	params, err = substituteSessionVariables(params, sessionVariables, startLen)
	if err != nil {
		return nil, 0, false, err
	}

	return params, paramIndex, true, nil
}

// columnLookup is injected by callers because the permissions package doesn't
// keep its own column list — the parent-package table owns the column data
// and we only need a one-shot lookup when inspecting insert-check filters.
type columnLookup func(sqlName string) *core.Column

// RequiresPostInsertCheck reports whether the insert-check for role must be
// evaluated after the INSERT (against RETURNING *) rather than against the
// input data. The pre-mutation check builds its data subquery from the insert
// payload, filling any referenced-but-absent column with NULL. That diverges
// from the inserted row whenever a check-referenced column takes a database
// value the payload doesn't carry:
//
//   - generated columns (value computed by the DB);
//   - identity columns (Postgres GENERATED [ALWAYS|BY DEFAULT] AS IDENTITY,
//     SQLite INTEGER PRIMARY KEY rowid aliases) — the engine populates the
//     value at INSERT time and the pre-check would compare against the NULL
//     placeholder regardless of whether the payload could ever carry it; or
//   - columns with a DEFAULT that are absent from the insert payload — the
//     pre-check sees NULL, but the inserted row carries the default.
//
// The divergence is silent and dangerous for relationship checks: a composite
// FK join column (e.g. a pinned `parent_kind` discriminator) defaulted by the
// DB would join on NULL and fail the check even though the row is valid.
//
// presentColumns is the set of column SQL names that carry a concrete value
// for every row being inserted (the intersection across rows, plus FK columns
// bound from a captured parent row); a column outside it may fall back to its default
// for at least one row.
func (s *Store) RequiresPostInsertCheck(
	role string,
	presentColumns map[string]struct{},
	lookup columnLookup,
) bool {
	clause, ok := s.Insert[role]
	if !ok {
		return false
	}

	if where.ContainsComputed(clause) || where.ContainsRootColumn(clause) {
		// Pre-insert data is not a complete typed physical row. Even when
		// every input column is supplied, defaults, triggers and nested inserts
		// can change the value read by the function.
		return true
	}

	for _, colName := range where.CollectSourceColumns(clause) {
		col := lookup(colName)
		if col == nil {
			continue
		}

		if col.IsGenerated || col.IsIdentity {
			return true
		}

		if col.HasDefault {
			if _, present := presentColumns[colName]; !present {
				return true
			}
		}
	}

	return false
}

// MissingInsertColumns lists the columns the insert-check filter for role
// references that aren't in present and aren't generated or identity. Both
// generated and identity columns are skipped — they require a post-mutation
// check (see RequiresPostInsertCheck) and a NULL placeholder for them in the
// pre-mutation data CTE would either be unused (post-check is taken) or
// outright wrong (NULL against a NOT NULL identity column would mask the real
// engine-assigned value).
//
// Returned in source-walk order, deduplicated. Useful for emitting NULL
// placeholders in the pre-mutation check data subquery so the WHERE doesn't
// fail with "column does not exist".
func (s *Store) MissingInsertColumns(
	role string,
	present map[string]struct{},
	lookup columnLookup,
) []*core.Column {
	clause, ok := s.Insert[role]
	if !ok {
		return nil
	}

	permCols := where.CollectSourceColumns(clause)
	if len(permCols) == 0 {
		return nil
	}

	added := make(map[string]struct{})

	var missing []*core.Column

	for _, colName := range permCols {
		if _, ok := present[colName]; ok {
			continue
		}

		if _, ok := added[colName]; ok {
			continue
		}

		col := lookup(colName)
		if col == nil || col.IsGenerated || col.IsIdentity {
			continue
		}

		added[colName] = struct{}{}

		missing = append(missing, col)
	}

	return missing
}

// ExtendInsertColumns returns allColumns with any non-generated, non-identity
// columns the insert-check filter for role references appended. Generated and
// identity columns are excluded for the same reason MissingInsertColumns
// skips them: the post-check path is taken in those cases, so extending the
// pre-check column list would be wasted work or, worse, would lead the
// pre-check subquery to project a NULL placeholder under the identity column
// name and shadow the engine-assigned value. The returned slice does not
// share backing storage with allColumns (callers can keep using the original
// safely).
func (s *Store) ExtendInsertColumns(
	allColumns []string,
	role string,
	lookup columnLookup,
) []string {
	clause, ok := s.Insert[role]
	if !ok {
		return allColumns
	}

	permCols := where.CollectSourceColumns(clause)
	if len(permCols) == 0 {
		return allColumns
	}

	existing := make(map[string]struct{}, len(allColumns))
	for _, col := range allColumns {
		existing[col] = struct{}{}
	}

	extended := append([]string{}, allColumns...)

	for _, col := range permCols {
		if _, ok := existing[col]; ok {
			continue
		}

		colObj := lookup(col)
		if colObj != nil && !colObj.IsGenerated && !colObj.IsIdentity {
			existing[col] = struct{}{}
			extended = append(extended, col)
		}
	}

	return extended
}
