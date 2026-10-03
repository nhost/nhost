package migrations

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/nhost/nhost/internal/lib/hasura/metadata"
)

const defaultTimeout = 10 * time.Second

//nolint:exhaustruct
func storageTables(dbName string) []metadata.TrackTable { //nolint:funlen
	return []metadata.TrackTable{
		{
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: schemaStorage,
					Name:   tableBuckets,
				},
				Configuration: metadata.Configuration{
					CustomName: tableBuckets,
					CustomRootFields: metadata.CustomRootFields{
						Select:          tableBuckets,
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
						colCreatedAt:             fieldCreatedAt,
						colUpdatedAt:             fieldUpdatedAt,
						"download_expiration":    "downloadExpiration",
						"min_upload_file_size":   "minUploadFileSize",
						"max_upload_file_size":   "maxUploadFileSize",
						"cache_control":          "cacheControl",
						"presigned_urls_enabled": "presignedUrlsEnabled",
					},
				},
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: tableFiles,
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: schemaStorage,
									Name:   tableFiles,
								},
								Columns: []string{colBucketID},
							},
						},
					},
				},
			},
		},
		{
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: schemaStorage,
					Name:   tableFiles,
				},
				Configuration: metadata.Configuration{
					CustomName: tableFiles,
					CustomRootFields: metadata.CustomRootFields{
						Select:          tableFiles,
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
						colCreatedAt:          fieldCreatedAt,
						colUpdatedAt:          fieldUpdatedAt,
						colBucketID:           "bucketId",
						"name":                "name",
						"size":                "size",
						"mime_type":           "mimeType",
						"etag":                "etag",
						"is_uploaded":         "isUploaded",
						"uploaded_by_user_id": "uploadedByUserId",
						"metadata":            "metadata",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "bucket",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: colBucketID,
						},
					},
				},
			},
		},
		{
			Type: pgTrackTable,
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: schemaStorage,
					Name:   virus,
				},
				Configuration: metadata.Configuration{
					CustomName: virus,
					CustomRootFields: metadata.CustomRootFields{
						Select:          "viruses",
						SelectByPk:      virus,
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
						colCreatedAt:   fieldCreatedAt,
						colUpdatedAt:   fieldUpdatedAt,
						"file_id":      "fileId",
						"filename":     "filename",
						virus:          virus,
						"user_session": "userSession",
					},
				},
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "file",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "file_id",
						},
					},
				},
			},
		},
	}
}

func ApplyHasuraMetadata(
	ctx context.Context, baseURL, hasuraSecret, hasuraDBName string, logger *slog.Logger,
) error {
	cfg := metadata.Config{
		URL:         baseURL + "/metadata",
		AdminSecret: hasuraSecret,
		DBName:      hasuraDBName,
		Timeout:     defaultTimeout,
	}

	if err := metadata.ApplyMetadata(ctx, cfg, storageTables(hasuraDBName), logger); err != nil {
		return fmt.Errorf("applying Hasura metadata: %w", err)
	}

	return nil
}

// Hasura metadata identifiers: schema/table/column names and camelCase field names.
const (
	colBucketID    = "bucket_id"
	tableBuckets   = "buckets"
	fieldCreatedAt = "createdAt"
	colCreatedAt   = "created_at"
	tableFiles     = "files"
	pgTrackTable   = "pg_track_table"
	schemaStorage  = "storage"
	fieldUpdatedAt = "updatedAt"
	colUpdatedAt   = "updated_at"
	virus          = "virus"
)
