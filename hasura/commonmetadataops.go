package hasura

import (
	"io"
)

//  general hasura metadata API requests
//  these are not dependent on the connected source type
type CommonMetadataOperations interface {
	ExportMetadata() (metadata io.Reader, err error)
	ClearMetadata() (io.Reader, error)
	ReloadMetadata() (io.Reader, error)
	DropInconsistentMetadata() (io.Reader, error)
	ReplaceMetadata(metadata io.Reader) (io.Reader, error)
	GetInconsistentMetadata() (*InconsistentMetadataResponse, error)
	GetInconsistentMetadataReader() (io.Reader, error)
}

type V2ReplaceMetadataArgs struct {
	AllowInconsistentMetadata bool        `json:"allow_inconsistent_metadata"`
	Metadata                  interface{} `json:"metadata"`
}

type V2ReplaceMetadataResponse struct {
	IsConsistent        bool        `json:"is_consistent"`
	InconsistentObjects interface{} `json:"inconsistent_objects"`
}

type InconsistentMetadataResponse struct {
	IsConsistent        bool `json:"is_consistent"`
	InconsistentObjects []struct {
		Type       string `json:"type"`
		Name       string `json:"name"`
		Reason     string `json:"reason"`
		Definition struct {
			Name   string `json:"name"`
			Schema string `json:"schema"`
		} `json:"definition"`
		Table struct {
			Name   string `json:"name"`
			Schema string `json:"schema"`
		} `json:"table"`
	} `json:"inconsistent_objects"`
}
