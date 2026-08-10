package customization

// wrapperTypeName returns the name of the object type that holds a root
// operation's fields once they are wrapped under a namespace field. rootKind
// is the canonical operation kind: "Query", "Mutation", or "Subscription".
//
// This must match Hasura's introspection output byte-for-byte, because the
// integration suite diffs Constellation's schema against Hasura's. The two
// source flavors diverge, both verified against a live Hasura introspection:
//
//   - Remote schemas: <namespace><Kind> with the namespace verbatim and the
//     type prefix/suffix NOT applied — e.g. namespace "league" yields
//     "leagueQuery"/"leagueMutation".
//   - Database sources: <namespace>_query / <namespace>_mutation_frontend /
//     <namespace>_subscription, run through the type prefix/suffix rules — e.g.
//     namespace "catalog" with prefix "Catalog" yields "Catalogcatalog_query".
func (r *renamer) wrapperTypeName(rootKind string) string {
	if r.flavor == FlavorDatabase {
		return r.typeName(r.cfg.RootFieldsNamespace + databaseWrapperSuffix(rootKind))
	}

	return r.cfg.RootFieldsNamespace + rootKind
}

// databaseWrapperSuffix returns the suffix Hasura appends to a database
// namespace for each root operation kind's wrapper type. Mutation uses the
// "_mutation_frontend" suffix Hasura emits (not "_mutation").
func databaseWrapperSuffix(rootKind string) string {
	switch rootKind {
	case "Mutation":
		return "_mutation_frontend"
	case "Subscription":
		return "_subscription"
	default:
		return "_query"
	}
}
