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

// IntegrityError reports a migration catalog row that cannot be trusted or
// does not agree with the immutable embedded bundle.
type IntegrityError struct {
	Version uint
	Issue   string
	Cause   error
}

// Error implements error.
func (e *IntegrityError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf(
			"migration catalog integrity failure at version %d: %s: %v",
			e.Version,
			e.Issue,
			e.Cause,
		)
	}

	return fmt.Sprintf("migration catalog integrity failure at version %d: %s", e.Version, e.Issue)
}

// Unwrap returns the underlying integrity failure, if any.
func (e *IntegrityError) Unwrap() error {
	return e.Cause
}
