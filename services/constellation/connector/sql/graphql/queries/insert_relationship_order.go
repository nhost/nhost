package queries

import (
	"slices"

	"github.com/zeebo/xxh3"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

// insertRelationshipLess emulates Data.HashMap.Strict's traversal of FieldName
// Text in the pinned Hasura v2.50.3-ce image (text 2.1.3, hashable 1.5.1.0
// with xxHash 0.8.3, unordered-containers 0.2.21): the observed order matches
// seed-zero XXH3-64 on UTF-8 names and five-bit fragments from the least
// significant end. For a full-hash collision
// (which the pinned map can resolve by insertion order), use the metadata
// name as a deterministic tie-breaker rather than GraphQL input order.
func insertRelationshipLess(a, b string) bool {
	const (
		fragmentBits = 5
		fragmentMask = (1 << fragmentBits) - 1
	)

	ha, hb := xxh3.HashString(a), xxh3.HashString(b)
	for shift := uint(0); shift < 64; shift += fragmentBits {
		fa, fb := (ha>>shift)&fragmentMask, (hb>>shift)&fragmentMask
		if fa != fb {
			return fa < fb
		}
	}

	return a < b
}

func sortedInsertRelationships(objects []arguments.NestedInsert) []arguments.NestedInsert {
	ordered := slices.Clone(objects)
	slices.SortFunc(ordered, func(a, b arguments.NestedInsert) int {
		switch {
		case insertRelationshipLess(a.RelationshipName, b.RelationshipName):
			return -1
		case insertRelationshipLess(b.RelationshipName, a.RelationshipName):
			return 1
		default:
			return 0
		}
	})

	return ordered
}
