package hasura

// LoadDiagnostic records a non-fatal problem while parsing optional Hasura
// metadata sections such as actions.yaml or top-level JSON action fields.
type LoadDiagnostic struct {
	Kind   string
	Source string
	Name   string
	Reason string
}
