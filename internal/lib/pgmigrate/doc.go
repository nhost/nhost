// Package pgmigrate validates and applies versioned PostgreSQL migration
// bundles while preserving enough immutable information to support later-image
// downgrades. Migration bundles use golang-migrate filenames, pair every up
// body with an executable down body, and retain the exact SQL bytes used to
// calculate their checksums.
//
// Callers own the database pool supplied to this package. Catalog format 1 and
// its exact SQL-byte representation are a compatibility boundary: additive
// catalog changes may extend that format, but must not prevent an older image
// from reading migration bodies registered by a newer image.
package pgmigrate
