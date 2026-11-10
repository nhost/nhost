package pgmigrate

import (
	"fmt"
)

// ConfigurationError reports an invalid caller-supplied migration setting.
type ConfigurationError struct {
	Field string
	Issue string
	Cause error
}

// Error implements error.
func (e *ConfigurationError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf(
			"invalid migration configuration for %q: %s: %v",
			e.Field,
			e.Issue,
			e.Cause,
		)
	}

	return fmt.Sprintf("invalid migration configuration for %q: %s", e.Field, e.Issue)
}

// Unwrap returns the underlying configuration failure, if any.
func (e *ConfigurationError) Unwrap() error {
	return e.Cause
}

// BundleError reports malformed, incomplete, or unusable embedded migrations.
type BundleError struct {
	Path  string
	Issue string
	Cause error
}

// Error implements error.
func (e *BundleError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("invalid migration bundle at %q: %s: %v", e.Path, e.Issue, e.Cause)
	}

	return fmt.Sprintf("invalid migration bundle at %q: %s", e.Path, e.Issue)
}

// Unwrap returns the underlying bundle failure, if any.
func (e *BundleError) Unwrap() error {
	return e.Cause
}

// IntegrityError reports an integrity violation in the migration catalog,
// persisted migration state, or preflight migration path that makes execution
// unsafe. Version identifies the migration or requested target involved when
// non-nil; it is nil when no migration version applies or one cannot be decoded.
type IntegrityError struct {
	Version *uint
	Issue   string
	Cause   error
}

// Error implements error.
func (e *IntegrityError) Error() string {
	prefix := "migration integrity failure"
	if e.Version != nil {
		prefix = fmt.Sprintf("migration integrity failure at version %d", *e.Version)
	}

	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", prefix, e.Issue, e.Cause)
	}

	return fmt.Sprintf("%s: %s", prefix, e.Issue)
}

// Unwrap returns the underlying integrity failure, if any.
func (e *IntegrityError) Unwrap() error {
	return e.Cause
}
