package migrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	timeout = 10
)

type hasuraErrResponse struct {
	Path  string `json:"path"`
	Error string `json:"error"`
	Code  string `json:"code"`
}

func postMetadata(baseURL, hasuraSecret string, data interface{}) error {
	client := &http.Client{ //nolint: exhaustruct
		Timeout: time.Second * timeout,
	}

	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("problem marshalling data: %w", err)
	}

	req, err := http.NewRequestWithContext(
		context.Background(),
		http.MethodPost,
		baseURL+"/metadata",
		bytes.NewBuffer(b),
	)
	if err != nil {
		return fmt.Errorf("problem creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("X-Hasura-Admin-Secret", hasuraSecret)

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("problem executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResponse *hasuraErrResponse

		b, _ := io.ReadAll(resp.Body)
		if err := json.Unmarshal(b, &errResponse); err != nil {
			return fmt.Errorf( //nolint: err113
				"status_code: %d\nresponse: %s",
				resp.StatusCode,
				b,
			)
		}

		if errResponse.Code == "already-tracked" || errResponse.Code == "already-exists" {
			return nil
		}

		return fmt.Errorf("status_code: %d\nresponse: %s", resp.StatusCode, b) //nolint: err113
	}

	return nil
}

type TrackTable struct {
	Type string           `json:"type"`
	Args PgTrackTableArgs `json:"args"`
}

type Table struct {
	Schema string `json:"schema"`
	Name   string `json:"name"`
}

type CustomRootFields struct {
	Select          string `json:"select"`
	SelectByPk      string `json:"select_by_pk"`     //nolint: tagliatelle
	SelectAggregate string `json:"select_aggregate"` //nolint: tagliatelle
	Insert          string `json:"insert"`
	InsertOne       string `json:"insert_one"` //nolint: tagliatelle
	Update          string `json:"update"`
	UpdateByPk      string `json:"update_by_pk"` //nolint: tagliatelle
	Delete          string `json:"delete"`
	DeleteByPk      string `json:"delete_by_pk"` //nolint: tagliatelle
}

type Configuration struct {
	CustomName        string            `json:"custom_name"`         //nolint: tagliatelle
	CustomRootFields  CustomRootFields  `json:"custom_root_fields"`  //nolint: tagliatelle
	CustomColumnNames map[string]string `json:"custom_column_names"` //nolint: tagliatelle
}

type PgTrackTableArgs struct {
	Source        string        `json:"source"`
	Table         Table         `json:"table"`
	Configuration Configuration `json:"configuration"`
}

type CreateObjectRelationship struct {
	Type string                       `json:"type"`
	Args CreateObjectRelationshipArgs `json:"args"`
}

type CreateObjectRelationshipUsing struct {
	ForeignKeyConstraintOn []string `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type CreateObjectRelationshipArgs struct {
	Table  Table                         `json:"table"`
	Name   string                        `json:"name"`
	Source string                        `json:"source"`
	Using  CreateObjectRelationshipUsing `json:"using"`
}

type CreateArrayRelationship struct {
	Type string                      `json:"type"`
	Args CreateArrayRelationshipArgs `json:"args"`
}

type ForeignKeyConstraintOn struct {
	Table   Table    `json:"table"`
	Columns []string `json:"columns"`
}

type CreateArrayRelationshipUsing struct {
	ForeignKeyConstraintOn ForeignKeyConstraintOn `json:"foreign_key_constraint_on"` //nolint: tagliatelle
}

type CreateArrayRelationshipArgs struct {
	Table  Table                        `json:"table"`
	Name   string                       `json:"name"`
	Source string                       `json:"source"`
	Using  CreateArrayRelationshipUsing `json:"using"`
}

type DropRelationship struct {
	Type string               `json:"type"`
	Args DropRelationshipArgs `json:"args"`
}

type DropRelationshipArgs struct {
	Table        string `json:"table"`
	Source       string `json:"source"`
	Cascade      bool   `json:"cascade"`
	Relationship string `json:"relationship"`
}

func ApplyHasuraMetadata(url, hasuraSecret, hasuraDBName string) error { //nolint: funlen
	bucketsTable := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: hasuraDBName,
			Table: Table{
				Schema: "storage",
				Name:   "buckets",
			},
			Configuration: Configuration{
				CustomName: "buckets",
				CustomRootFields: CustomRootFields{
					Select:          "buckets",
					SelectByPk:      "bucket",
					SelectAggregate: "bucketsAggregate",
					Insert:          "insertBuckets",
					InsertOne:       "insertBucket",
					Update:          "updateBuckets",
					UpdateByPk:      "updateBucket",
					Delete:          "deleteBuckets",
					DeleteByPk:      "deleteBucket",
				},
				CustomColumnNames: map[string]string{
					"id":                     "id",
					"created_at":             "createdAt",
					"updated_at":             "updatedAt",
					"download_expiration":    "downloadExpiration",
					"min_upload_file_size":   "minUploadFileSize",
					"max_upload_file_size":   "maxUploadFileSize",
					"cache_control":          "cacheControl",
					"presigned_urls_enabled": "presignedUrlsEnabled",
				},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, bucketsTable); err != nil {
		return fmt.Errorf("problem adding metadata for the buckets table: %w", err)
	}

	filesTable := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: hasuraDBName,
			Table: Table{
				Schema: "storage",
				Name:   "files",
			},
			Configuration: Configuration{
				CustomName: "files",
				CustomRootFields: CustomRootFields{
					Select:          "files",
					SelectByPk:      "file",
					SelectAggregate: "filesAggregate",
					Insert:          "insertFiles",
					InsertOne:       "insertFile",
					Update:          "updateFiles",
					UpdateByPk:      "updateFile",
					Delete:          "deleteFiles",
					DeleteByPk:      "deleteFile",
				},
				CustomColumnNames: map[string]string{
					"id":                  "id",
					"created_at":          "createdAt",
					"updated_at":          "updatedAt",
					"bucket_id":           "bucketId",
					"name":                "name",
					"size":                "size",
					"mime_type":           "mimeType",
					"etag":                "etag",
					"is_uploaded":         "isUploaded",
					"uploaded_by_user_id": "uploadedByUserId",
					"metadata":            "metadata",
				},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, filesTable); err != nil {
		return fmt.Errorf("problem adding metadata for the files table: %w", err)
	}

	virusTable := TrackTable{
		Type: "pg_track_table",
		Args: PgTrackTableArgs{
			Source: hasuraDBName,
			Table: Table{
				Schema: "storage",
				Name:   "virus",
			},
			Configuration: Configuration{
				CustomName: "virus",
				CustomRootFields: CustomRootFields{
					Select:          "viruses",
					SelectByPk:      "virus",
					SelectAggregate: "virusesAggregate",
					Insert:          "insertViruses",
					InsertOne:       "insertVirus",
					Update:          "updateViruses",
					UpdateByPk:      "updateVirus",
					Delete:          "deleteViruses",
					DeleteByPk:      "deleteVirus",
				},
				CustomColumnNames: map[string]string{
					"id":           "id",
					"created_at":   "createdAt",
					"updated_at":   "updatedAt",
					"file_id":      "fileId",
					"filename":     "filename",
					"virus":        "virus",
					"user_session": "userSession",
				},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, virusTable); err != nil {
		return fmt.Errorf("problem adding metadata for the virus table: %w", err)
	}

	objRelationshipBuckets := CreateObjectRelationship{
		Type: "pg_create_object_relationship",
		Args: CreateObjectRelationshipArgs{
			Table: Table{
				Schema: "storage",
				Name:   "files",
			},
			Name:   "bucket",
			Source: hasuraDBName,
			Using: CreateObjectRelationshipUsing{
				ForeignKeyConstraintOn: []string{"bucket_id"},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, objRelationshipBuckets); err != nil {
		return fmt.Errorf("problem creaiing object relationship for buckets: %w", err)
	}

	arrRelationship := CreateArrayRelationship{
		Type: "pg_create_array_relationship",
		Args: CreateArrayRelationshipArgs{
			Table: Table{
				Schema: "storage",
				Name:   "buckets",
			},
			Name:   "files",
			Source: hasuraDBName,
			Using: CreateArrayRelationshipUsing{
				ForeignKeyConstraintOn: ForeignKeyConstraintOn{
					Table: Table{
						Schema: "storage",
						Name:   "files",
					},
					Columns: []string{"bucket_id"},
				},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, arrRelationship); err != nil {
		return fmt.Errorf("problem creating array relationships: %w", err)
	}

	objRelationshipVirusFile := CreateObjectRelationship{
		Type: "pg_create_object_relationship",
		Args: CreateObjectRelationshipArgs{
			Table: Table{
				Schema: "storage",
				Name:   "virus",
			},
			Name:   "file",
			Source: hasuraDBName,
			Using: CreateObjectRelationshipUsing{
				ForeignKeyConstraintOn: []string{"file_id"},
			},
		},
	}

	if err := postMetadata(url, hasuraSecret, objRelationshipVirusFile); err != nil {
		return fmt.Errorf("problem creaiing object relationship for buckets: %w", err)
	}

	return nil
}
