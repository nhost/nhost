package where

// Aliases controls the alias prefixes for EXISTS subqueries.
// Different prefixes prevent alias collisions between query WHERE clauses
// and permission WHERE clauses when both contain relationship traversals.
//
// Callers should use the two package-level instances [QueryAliases] and
// [PermissionAliases] rather than constructing their own; the prefixes
// "f"/"e" and "g"/"h" are reserved across the nested Parse call stack and
// constructing a third set risks alias collisions in deep relationship
// traversals.
type Aliases struct {
	// Relationship is the prefix used when emitting an EXISTS subquery for a
	// relationship traversal (e.g. f0, f1 nested by level).
	Relationship string
	// Exists is the prefix used when emitting an EXISTS subquery for the
	// _exists permission operator (e.g. e0, e1 nested by level).
	Exists string
}

//nolint:gochecknoglobals
var (
	// QueryAliases is the alias set used when parsing user-supplied where clauses.
	QueryAliases = Aliases{Relationship: "f", Exists: "e"}

	// PermissionAliases is the alias set used when parsing permission filter clauses.
	PermissionAliases = Aliases{Relationship: "g", Exists: "h"}
)
