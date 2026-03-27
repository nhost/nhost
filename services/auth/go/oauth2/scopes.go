package oauth2

import (
	"regexp"
	"slices"
	"strings"
)

// graphqlRoleScopeRe matches scopes of the form "graphql:role:<name>" where
// <name> consists of alphanumeric characters, hyphens, underscores, colons,
// or dots. Colons are allowed because role names (e.g. "user:mcp") may
// contain them. There is no parsing ambiguity because the prefix
// "graphql:role:" is fixed and scopes are space-delimited.
var graphqlRoleScopeRe = regexp.MustCompile(`^graphql:role:([a-zA-Z0-9_:.-]+)$`)

const graphqlRoleScopePrefix = "graphql:role:"

// isGraphQLRoleScope reports whether scope has the form "graphql:role:<name>".
func isGraphQLRoleScope(scope string) bool {
	return graphqlRoleScopeRe.MatchString(scope)
}

// extractGraphQLRoles returns the role names from all "graphql:role:<name>"
// scopes present in the list, preserving order. The first element is intended
// to be used as the default role.
func extractGraphQLRoles(scopes []string) []string {
	var roles []string

	for _, s := range scopes {
		if strings.HasPrefix(s, graphqlRoleScopePrefix) {
			name := s[len(graphqlRoleScopePrefix):]
			if name != "" {
				roles = append(roles, name)
			}
		}
	}

	return roles
}

// isScopeAllowed reports whether the requested scope is permitted by the
// client's allowed scopes. The plain "graphql" scope acts as a superset of
// "graphql:role:xxxx" — if a client is allowed "graphql", any
// "graphql:role:xxxx" scope is implicitly permitted. The reverse is not true:
// having "graphql:role:xxxx" does not implicitly grant "graphql".
func isScopeAllowed(scope string, clientScopes []string) bool {
	if slices.Contains(clientScopes, scope) {
		return true
	}

	if isGraphQLRoleScope(scope) && slices.Contains(clientScopes, "graphql") {
		return true
	}

	return false
}

// validateGraphQLScopeCombination checks that the plain "graphql" scope and
// "graphql:role:xxxx" scopes are not mixed in the same request. Returns an
// error description string, or "" if the combination is valid.
func validateGraphQLScopeCombination(scopes []string) string {
	hasGraphQL := slices.Contains(scopes, "graphql")
	hasRoleScope := len(extractGraphQLRoles(scopes)) > 0

	if hasGraphQL && hasRoleScope {
		return `"graphql" and "graphql:role:..." scopes are mutually exclusive`
	}

	return ""
}
