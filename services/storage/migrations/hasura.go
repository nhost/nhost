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
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: "storage",
					Name:   "buckets",
				},
				Configuration: metadata.Configuration{
					CustomName: "buckets",
					CustomRootFields: metadata.CustomRootFields{
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
				ArrayRelationships: []metadata.ArrayRelationshipConfig{
					{
						Name: "files",
						Using: metadata.ArrayRelationshipConfigUsing{
							ForeignKeyConstraintOn: metadata.ForeignKeyConstraintOn{
								Table: metadata.Table{
									Schema: "storage",
									Name:   "files",
								},
								Columns: []string{"bucket_id"},
							},
						},
					},
				},
			},
		},
		{
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: "storage",
					Name:   "files",
				},
				Configuration: metadata.Configuration{
					CustomName: "files",
					CustomRootFields: metadata.CustomRootFields{
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
				ObjectRelationships: []metadata.ObjectRelationshipConfig{
					{
						Name: "bucket",
						Using: metadata.ObjectRelationshipConfigUsing{
							ForeignKeyConstraintOn: "bucket_id",
						},
					},
				},
			},
		},
		{
			Type: "pg_track_table",
			Args: metadata.PgTrackTableArgs{
				Source: dbName,
				Table: metadata.Table{
					Schema: "storage",
					Name:   "virus",
				},
				Configuration: metadata.Configuration{
					CustomName: "virus",
					CustomRootFields: metadata.CustomRootFields{
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
