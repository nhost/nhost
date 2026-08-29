package graph

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
)

var (
	ErrUnknownOperation      = errors.New("unknown operation")
	ErrBucketAlreadyUploaded = errors.New("bucket already uploaded")
	ErrFileStoreNotFound     = errors.New("file store not found")
	ErrUpdatingLastSyncedAt  = errors.New("error updating last_synced_at")
)

type fileStoreBucketWebhookEvent struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			Old struct {
				FileStoreID string `json:"file_store_id"`
				BucketID    string `json:"bucket_id"`
			} `json:"old"`
			New struct {
				FileStoreID string `json:"file_store_id"`
				BucketID    string `json:"bucket_id"`
			} `json:"new"`
		} `json:"data"`
	}
}

func (r *Resolver) HandleFileStoreBucketsWebhook(c *gin.Context) {
	var e fileStoreBucketWebhookEvent
	if err := c.ShouldBindJSON(&e); err != nil {
		err := fmt.Errorf("error getting storage file metadata: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	switch e.Event.Op {
	case insertEvent:
		r.handleSyncExistingFiles(e, c)
		return
	case deleteEvent:
		r.handleDeleteExistingFiles(e, c)
		return
	case updateEvent:
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	default:
		err := fmt.Errorf("%w: %s", ErrUnknownOperation, e.Event.Op)
		webhookFail(c, http.StatusBadRequest, err)

		return
	}
}

func (r *Resolver) updateLastSyncedAt(c *gin.Context, id string) error {
	if _, err := r.hasura.UpdateGraphiteFileStores(
		c.Request.Context(),
		hasura.GraphiteFileStoresBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: &id,
			},
		},
		hasura.GraphiteFileStoresSetInput{ //nolint:exhaustruct
			LastSyncedAt: new(time.Now()),
		},
	); err != nil {
		return ErrUpdatingLastSyncedAt
	}

	return nil
}

func (r *Resolver) getFileStoreBuckets(
	c *gin.Context,
	bucketID string,
) ([]*hasura.GetGraphiteFileStoreBuckets_GraphiteFileStoreBuckets, error) {
	resp, err := r.hasura.GetGraphiteFileStoreBuckets(
		c.Request.Context(),
		&hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(bucketID),
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting file store bucket: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return nil, err
	}

	return resp.GetGraphiteFileStoreBuckets(), nil
}

func (r *Resolver) getFileStore(
	c *gin.Context,
	fileStoreID string,
) (*hasura.GetGraphiteFileStore_GraphiteFileStore, error) {
	fs, err := r.hasura.GetGraphiteFileStore(
		c.Request.Context(),
		fileStoreID,
	)
	if err != nil {
		err := fmt.Errorf("error getting file store: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return nil, err
	}

	if fs.GetGraphiteFileStore() == nil {
		c.JSON(http.StatusOK, gin.H{"message": "file store not found"})
		return nil, ErrFileStoreNotFound
	}

	return fs.GetGraphiteFileStore(), nil
}

func (r *Resolver) getFiles(
	c *gin.Context,
	bucketID string,
) ([]*hasura.GetStorageFiles_Files, error) {
	files, err := r.hasura.GetStorageFiles(
		c.Request.Context(),
		&hasura.FilesBoolExp{ //nolint:exhaustruct
			BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(bucketID),
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting storage files: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return nil, err
	}

	return files.GetFiles(), nil
}

func (r *Resolver) processFiles(
	c *gin.Context,
	files []*hasura.GetStorageFiles_Files,
	vectorStoreID string,
	alreadySynced bool,
	logger *slog.Logger,
) {
	for _, file := range files {
		if !isFileSupported(file) {
			logger.InfoContext(c.Request.Context(), "file not supported, skipping")
			continue
		}

		if err := r.processFile(c, file, vectorStoreID, alreadySynced, logger); err != nil {
			logger.ErrorContext(c.Request.Context(), err.Error())
		}
	}
}

func (r *Resolver) processFile(
	c *gin.Context,
	file *hasura.GetStorageFiles_Files,
	vectorStoreID string,
	alreadySynced bool,
	logger *slog.Logger,
) error {
	var id string

	if !alreadySynced { //nolint:nestif
		logger.InfoContext(c.Request.Context(), "downloading file from nhost storage")

		sf, err := r.downloadStorageFile(c, file.ID)
		if err != nil {
			return fmt.Errorf("failed to download storage file: %w", err)
		}

		// upload file to openai
		logger.InfoContext(c.Request.Context(), "uploading file to openai")

		f, err := r.uploadOpenAIFile(c, sf.Body, *file.GetName(), logger)
		if err != nil {
			return fmt.Errorf("failed to upload to OpenAI: %w", err)
		}

		id = f.JSON200.Id

		logger.InfoContext(c.Request.Context(), "inserting file metadata in graphite")

		if err := r.insertGraphiteFile(c, id, file.GetID(), *file.GetEtag()); err != nil {
			return fmt.Errorf("failed to insert file metadata: %w", err)
		}
	} else {
		// get openai file id from graphite
		gFile, err := r.hasura.GetGraphiteFilesMetadata(
			c.Request.Context(),
			&hasura.GraphiteFilesBoolExp{ //nolint:exhaustruct
				StorageFileID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
					Eq: new(file.GetID()),
				},
			},
		)
		if err != nil {
			return fmt.Errorf("failed to get graphite file: %w", err)
		}

		id = gFile.GetGraphiteFiles()[0].GetFileID()
	}

	logger.InfoContext(c.Request.Context(), "adding file to vector store")

	if err := r.addFileToVectorStores(c, []string{vectorStoreID}, id); err != nil {
		return fmt.Errorf("failed to add file to vector stores: %w", err)
	}

	return nil
}

func (r *Resolver) handleSyncExistingFiles(
	e fileStoreBucketWebhookEvent,
	c *gin.Context,
) {
	logger := middleware.LoggerFromContext(c.Request.Context())
	bucketID := e.Event.Data.New.BucketID
	fileStoreID := e.Event.Data.New.FileStoreID
	alreadySynced := false

	fsBuckets, err := r.getFileStoreBuckets(c, bucketID)
	if err != nil {
		return
	}

	if len(fsBuckets) > 1 {
		// bucket already being used by another file store
		// we don't need to upload the files again
		// but we need to add the file IDs to this new file store
		alreadySynced = true
	}

	fs, err := r.getFileStore(c, fileStoreID)
	if err != nil {
		return
	}

	files, err := r.getFiles(c, bucketID)
	if err != nil {
		return
	}

	r.processFiles(c, files, *fs.GetVectorStoreID(), alreadySynced, logger)

	if err = r.updateLastSyncedAt(c, e.Event.Data.New.FileStoreID); err != nil {
		logger.InfoContext(c.Request.Context(), err.Error())
	}

	c.JSON(http.StatusOK, gin.H{"message": "files synced successfully"})
}

func (r *Resolver) isBucketInUse(c *gin.Context, bucketID string) (bool, error) {
	resp, err := r.hasura.GetGraphiteFileStoreBuckets(
		c.Request.Context(),
		&hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(bucketID),
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting file store bucket: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return false, err
	}

	return len(resp.GetGraphiteFileStoreBuckets()) > 0, nil
}

func (r *Resolver) getStorageFilesFromBucket(
	c *gin.Context,
	bucketID string,
) ([]*hasura.GetStorageFiles_Files, error) {
	files, err := r.hasura.GetStorageFiles(
		c.Request.Context(),
		&hasura.FilesBoolExp{ //nolint:exhaustruct
			BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: new(bucketID),
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting storage files: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return nil, err
	}

	return files.GetFiles(), nil
}

func (r *Resolver) deleteAssociatedFiles(
	c *gin.Context,
	files []*hasura.GetStorageFiles_Files,
	logger *slog.Logger,
) error {
	sids := make([]string, len(files))
	for i, f := range files {
		sids[i] = f.GetID()
	}

	oaiFiles, err := r.hasura.GetGraphiteFilesMetadata(
		c.Request.Context(),
		&hasura.GraphiteFilesBoolExp{ //nolint:exhaustruct
			StorageFileID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				In: sids,
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting graphite files metadata: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return err
	}

	for _, gf := range oaiFiles.GetGraphiteFiles() {
		if err := r.ai.FilesDelete(c.Request.Context(), gf.FileID, logger); err != nil {
			logger.ErrorContext(
				c.Request.Context(),
				"error deleting file %s from openai: %v",
				gf.FileID,
				err,
			)
		}

		if _, err := r.hasura.DeleteGraphiteFile(c.Request.Context(), gf.GetID()); err != nil {
			logger.ErrorContext(
				c.Request.Context(),
				"error deleting file metadata %s from graphite: %v",
				gf.GetID(),
				err,
			)
		}
	}

	return nil
}

func (r *Resolver) handleDeleteExistingFiles(
	e fileStoreBucketWebhookEvent,
	c *gin.Context,
) {
	logger := middleware.LoggerFromContext(c.Request.Context())
	bucketID := e.Event.Data.Old.BucketID

	if inUse, err := r.isBucketInUse(c, bucketID); err != nil {
		return
	} else if inUse {
		c.JSON(http.StatusOK, gin.H{"message": "bucket still in use"})
		return
	}

	files, err := r.getStorageFilesFromBucket(c, bucketID)
	if err != nil {
		return
	}

	if err := r.deleteAssociatedFiles(c, files, logger); err != nil {
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "files deleted successfully"})
}
