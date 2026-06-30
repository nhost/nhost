package connector

import "errors"

// ErrUnsupportedDatabaseKind is returned when metadata references a database
// kind that has no registered factory (e.g. an unknown driver name).
var ErrUnsupportedDatabaseKind = errors.New("unsupported database kind")

// ErrDatabaseURLNotSet is returned when a database's resolved connection URL
// is empty after consulting metadata and environment variables.
var ErrDatabaseURLNotSet = errors.New("database URL is not set")

// ErrUnsupportedCustomization is returned when a connector customization
// configuration uses a feature that is not yet supported by the execution
// path (e.g. per-type field_names renames).
var ErrUnsupportedCustomization = errors.New("unsupported customization")

// ErrActionLogStoreNotConfigured is returned when asynchronous action metadata
// exists but no PostgreSQL action-log store can be resolved.
var ErrActionLogStoreNotConfigured = errors.New("asynchronous action log store is not configured")
