package jsondiff

// An Option changes the default behavior of a Differ.
type Option func(*Differ)

// Factorize enables factorization of operations.
func Factorize() Option {
	return func(o *Differ) { o.opts.factorize = true }
}

// Rationalize enables rationalization of operations.
func Rationalize() Option {
	return func(o *Differ) { o.opts.rationalize = true }
}

// Equivalent disables the generation of operations for
// arrays of equal length and unordered/equal elements.
func Equivalent() Option {
	return func(o *Differ) { o.opts.equivalent = true }
}

// LCS uses a Longest Common Subsequence to compare
// arrays.
func LCS() Option {
	return func(o *Differ) { o.opts.lcs = true }
}

// Invertible enables the generation of an invertible
// patch, by preceding each remove and replace operation
// by a test operation that verifies the value at the
// path that is being removed/replaced.
// Note that copy operations are not invertible, and as
// such, using this option disable the usage of copy
// operation in favor of add operations.
func Invertible() Option {
	return func(o *Differ) { o.opts.invertible = true }
}

// MarshalFunc allows to define the function/package
// used to marshal objects to JSON.
// The prototype of fn must match the one of the
// encoding/json.Marshal function.
func MarshalFunc(fn marshalFunc) Option {
	return func(o *Differ) {
		o.opts.marshal = fn
	}
}

// UnmarshalFunc allows to define the function/package
// used to unmarshal objects from JSON.
// The prototype of fn must match the one of the
// encoding/json.Unmarshal function.
func UnmarshalFunc(fn unmarshalFunc) Option {
	return func(o *Differ) {
		o.opts.unmarshal = fn
	}
}

// SkipCompact instructs to skip the compaction of the input
// JSON documents when the Rationalize option is enabled.
func SkipCompact() Option {
	return func(o *Differ) {
		o.isCompact = true
	}
}

// InPlaceCompaction instructs to compact the input JSON
// documents in place; it does not allocate to create a
// copy, but modify the original byte slice instead.
// This option has no effect if used alongside SkipCompact.
func InPlaceCompaction() Option {
	return func(o *Differ) {
		o.compactInPlace = true
	}
}

// Ignores defines the list of values that are ignored
// by the diff generation, represented as a list of JSON
// Pointer strings (RFC 6901).
func Ignores(ptrs ...string) Option {
	return func(o *Differ) {
		if len(ptrs) == 0 {
			return
		}
		o.opts.ignores = make(map[string]struct{}, len(ptrs))
		for _, ptr := range ptrs {
			o.opts.ignores[ptr] = struct{}{}
		}
		o.opts.hasIgnore = true
	}
}
