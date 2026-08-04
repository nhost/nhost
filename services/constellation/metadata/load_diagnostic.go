package metadata

// LoadDiagnostic records a non-fatal problem encountered while parsing an
// optional metadata section. It is intentionally timestamp-free; runtime builds
// turn these into fresh Inconsistency entries so reloads reflect the build time.
type LoadDiagnostic struct {
	Kind   string
	Source string
	Name   string
	Reason string
}
