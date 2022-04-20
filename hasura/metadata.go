package hasura

type QualifiedTable struct {
	Name   string `json:"name"`
	Schema string `json:"schema"`
}

type TableEntry struct {
	IsEnum *bool          `json:"is_enum,omitempty"`
	Table  QualifiedTable `json:"table"`
}

type Source struct {
	Name   string       `json:"name"`
	Tables []TableEntry `json:"tables"`
}

type MetadataV3 struct {
	Sources []Source `json:"sources"`
}
