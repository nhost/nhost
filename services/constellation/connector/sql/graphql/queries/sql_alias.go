package queries

import (
	"fmt"
	"hash/fnv"
	"strings"
)

const maxPostgresIdentifierBytes = 63

// sqlAlias keeps generated SQL aliases within PostgreSQL's identifier limit.
// PostgreSQL truncates longer identifiers to 63 bytes before checking for
// duplicate table names, so aliases that share a long path prefix need a hash
// suffix to remain distinct.
func sqlAlias(parts ...string) string {
	alias := strings.Join(parts, "")
	if len(alias) <= maxPostgresIdentifierBytes {
		return alias
	}

	return shortenSQLAlias(alias)
}

func shortenSQLAlias(alias string) string {
	const (
		hashPrefix = ".h"
		hashBytes  = 16
		separator  = "."
	)

	suffix := alias
	if idx := strings.LastIndex(alias, "."); idx >= 0 && idx < len(alias)-1 {
		suffix = alias[idx+1:]
	}

	maxSuffixBytes := maxPostgresIdentifierBytes - len(hashPrefix) - hashBytes - len(separator) - 1
	if len(suffix) > maxSuffixBytes {
		suffix = suffix[:maxSuffixBytes]
	}

	hash := sqlAliasHash(alias)
	prefixBytes := max(
		maxPostgresIdentifierBytes-len(hashPrefix)-len(hash)-len(separator)-len(suffix),
		1,
	)

	prefix := alias[:prefixBytes]

	prefix = strings.TrimRight(prefix, ".")
	if prefix == "" {
		prefix = alias[:1]
	}

	return prefix + hashPrefix + hash + separator + suffix
}

func sqlAliasHash(alias string) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(alias))

	return fmt.Sprintf("%016x", h.Sum64())
}
