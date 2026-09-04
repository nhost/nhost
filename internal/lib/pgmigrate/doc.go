// Package pgmigrate validates and applies versioned PostgreSQL migration
// bundles. The highest embedded version is inferred as the image target, and
// every up body must have an executable down body with the same identifier.
//
// The database catalog retains exact SQL bytes and checksums so an older image
// can downgrade migrations that it does not embed. Applied rows remain
// immutable; successfully downgraded or conflicting unapplied suffixes are
// archived so a replacement release lineage can reuse their version sequence.
//
// Callers own the dedicated migration database pool supplied to this package.
package pgmigrate
