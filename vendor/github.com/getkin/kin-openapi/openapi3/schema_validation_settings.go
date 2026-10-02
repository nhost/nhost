package openapi3

import (
	"sync"
)

// SchemaValidationOption describes options a user has when validating request / response bodies.
type SchemaValidationOption func(*schemaValidationSettings)

type RegexCompilerFunc func(expr string) (RegexMatcher, error)

type RegexMatcher interface {
	MatchString(s string) bool
}

type schemaValidationSettings struct {
	failfast                    bool
	multiError                  bool
	asreq, asrep                bool // exclusive (XOR) fields
	formatValidationEnabled     bool
	patternValidationDisabled   bool
	readOnlyValidationDisabled  bool
	writeOnlyValidationDisabled bool
	useJSONSchema2020           bool // Use JSON Schema 2020-12 validator for OpenAPI 3.1

	regexCompiler RegexCompilerFunc

	onceSettingDefaults sync.Once
	defaultsSet         func()

	customizeMessageError func(err *SchemaError) string

	// Per-validation format validators (checked before global ones)
	stringFormats  map[string]StringFormatValidator
	numberFormats  map[string]NumberFormatValidator
	integerFormats map[string]IntegerFormatValidator
}

// FailFast returns schema validation errors quicker.
func FailFast() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.failfast = true }
}

func MultiErrors() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.multiError = true }
}

func VisitAsRequest() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.asreq, s.asrep = true, false }
}

func VisitAsResponse() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.asreq, s.asrep = false, true }
}

// EnableFormatValidation setting makes Validate not return an error when validating documents that mention schema formats that are not defined by the OpenAPIv3 specification.
func EnableFormatValidation() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.formatValidationEnabled = true }
}

// DisablePatternValidation setting makes Validate not return an error when validating patterns that are not supported by the Go regexp engine.
func DisablePatternValidation() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.patternValidationDisabled = true }
}

// DisableReadOnlyValidation setting makes Validate not return an error when validating properties marked as read-only
func DisableReadOnlyValidation() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.readOnlyValidationDisabled = true }
}

// DisableWriteOnlyValidation setting makes Validate not return an error when validating properties marked as write-only
func DisableWriteOnlyValidation() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.writeOnlyValidationDisabled = true }
}

// DefaultsSet executes the given callback (once) IFF schema validation set default values.
func DefaultsSet(f func()) SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.defaultsSet = f }
}

// SetSchemaErrorMessageCustomizer allows to override the schema error message.
// If the passed function returns an empty string, it returns to the previous Error() implementation.
func SetSchemaErrorMessageCustomizer(f func(err *SchemaError) string) SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.customizeMessageError = f }
}

// SetSchemaRegexCompiler allows to override the regex implementation used to validate field "pattern".
func SetSchemaRegexCompiler(c RegexCompilerFunc) SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.regexCompiler = c }
}

// WithStringFormatValidators adds per-validation string format validators.
// These validators are checked before global SchemaStringFormats and allow
// different validations for the same format name across different specs.
func WithStringFormatValidators(validators map[string]StringFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		s.stringFormats = validators
	}
}

// WithStringFormatValidator adds a single per-validation string format validator.
// This validator is checked before global SchemaStringFormats and allows
// different validations for the same format name across different specs.
func WithStringFormatValidator(name string, validator StringFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		if s.stringFormats == nil {
			s.stringFormats = make(map[string]StringFormatValidator)
		}
		s.stringFormats[name] = validator
	}
}

// WithNumberFormatValidators adds per-validation number format validators.
// These validators are checked before global SchemaNumberFormats and allow
// different validations for the same format name across different specs.
func WithNumberFormatValidators(validators map[string]NumberFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		s.numberFormats = validators
	}
}

// WithNumberFormatValidator adds a single per-validation number format validator.
// This validator is checked before global SchemaNumberFormats and allows
// different validations for the same format name across different specs.
func WithNumberFormatValidator(name string, validator NumberFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		if s.numberFormats == nil {
			s.numberFormats = make(map[string]NumberFormatValidator)
		}
		s.numberFormats[name] = validator
	}
}

// WithIntegerFormatValidators adds per-validation integer format validators.
// These validators are checked before global SchemaIntegerFormats and allow
// different validations for the same format name across different specs.
func WithIntegerFormatValidators(validators map[string]IntegerFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		s.integerFormats = validators
	}
}

// WithIntegerFormatValidator adds a single per-validation integer format validator.
// This validator is checked before global SchemaIntegerFormats and allows
// different validations for the same format name across different specs.
func WithIntegerFormatValidator(name string, validator IntegerFormatValidator) SchemaValidationOption {
	return func(s *schemaValidationSettings) {
		if s.integerFormats == nil {
			s.integerFormats = make(map[string]IntegerFormatValidator)
		}
		s.integerFormats[name] = validator
	}
}

// EnableJSONSchema2020 enables JSON Schema 2020-12 compliant validation.
// This enables support for OpenAPI 3.1 and JSON Schema 2020-12 features.
// When enabled, validation uses the jsonschema library instead of the built-in validator.
func EnableJSONSchema2020() SchemaValidationOption {
	return func(s *schemaValidationSettings) { s.useJSONSchema2020 = true }
}

func newSchemaValidationSettings(opts ...SchemaValidationOption) *schemaValidationSettings {
	settings := &schemaValidationSettings{}
	for _, opt := range opts {
		opt(settings)
	}
	return settings
}
