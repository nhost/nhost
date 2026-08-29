package graph

import (
	"bytes"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
	"github.com/nhost/nhost/services/ai/hasura"
	oapi "github.com/nhost/nhost/services/ai/openai/api"
	"github.com/nhost/nhost/services/ai/storage/api"
)

//nolint:tagliatelle
type storageFileWebhookEvent struct {
	Event struct {
		Op   string `json:"op"`
		Data struct {
			Old struct {
				ID         string `json:"id"`
				IsUploaded bool   `json:"is_uploaded"`
			} `json:"old"`
			New struct {
				ID         string `json:"id"`
				Name       string `json:"name"`
				IsUploaded bool   `json:"is_uploaded"`
				BucketID   string `json:"bucket_id"`
				Etag       string `json:"etag"`
			} `json:"new"`
		} `json:"data"`
	}
}

var (
	ErrFileNotSupported   = errors.New("file not supported")
	ErrFileStoresNotFound = errors.New("file stores not found")
	ErrFileUnchanged      = errors.New("file unchanged")
)

func (r *Resolver) HandleStorageFilesWebhook(c *gin.Context) {
	var e storageFileWebhookEvent
	if err := c.ShouldBindJSON(&e); err != nil {
		webhookFail(c, http.StatusBadRequest, err)
		return
	}

	switch e.Event.Op {
	case updateEvent:
		r.handleUploadFile(e, c)
		return
	case deleteEvent:
		r.handleDeleteFile(e, c)
		return
	case insertEvent:
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
		return
	default:
		err := fmt.Errorf("%w: %s", ErrUnknownOperation, e.Event.Op)
		webhookFail(c, http.StatusBadRequest, err)

		return
	}
}

func (r *Resolver) getStorageFile(
	c *gin.Context,
	id string,
) (*hasura.GetStorageFileMetadata, error) {
	resp, err := r.hasura.GetStorageFileMetadata(c.Request.Context(), id)
	if err != nil {
		return nil, fmt.Errorf("error getting storage file metadata: %w", err)
	}

	return resp, nil
}

func (r *Resolver) getVectorStoreIDs(
	c *gin.Context,
	bucketID string,
) ([]string, error) {
	fsb, err := r.hasura.GetGraphiteFileStoreBuckets(
		c.Request.Context(),
		&hasura.GraphiteFileStoreBucketsBoolExp{ //nolint:exhaustruct
			BucketID: &hasura.StringComparisonExp{ //nolint:exhaustruct
				Eq: &bucketID,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error getting file store buckets: %w", err)
	}

	ids := make([]string, len(fsb.GetGraphiteFileStoreBuckets()))
	for i, fs := range fsb.GetGraphiteFileStoreBuckets() {
		ids[i] = fs.GetFileStoreID()
	}

	fs, err := r.hasura.GetGraphiteFileStores(
		c.Request.Context(),
		&hasura.GraphiteFileStoresBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				In: ids,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error getting file stores: %w", err)
	}

	ids = make([]string, len(fs.GetGraphiteFileStores()))
	for i, f := range fs.GetGraphiteFileStores() {
		ids[i] = *f.GetVectorStoreID()
	}

	return ids, nil
}

func (r *Resolver) getGraphiteFile(
	c *gin.Context,
	id string,
) (*hasura.GetGraphiteFilesMetadata, error) {
	gf, err := r.hasura.GetGraphiteFilesMetadata(
		c.Request.Context(),
		&hasura.GraphiteFilesBoolExp{ //nolint:exhaustruct
			StorageFileID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: &id,
			},
		},
	)
	if err != nil {
		return nil, fmt.Errorf("error getting graphite file metadata: %w", err)
	}

	return gf, nil
}

func (r *Resolver) downloadStorageFile(c *gin.Context, id string) (*api.GetFilesIdR, error) {
	sf, err := r.storage.GetFilesIdWithResponse(
		c.Request.Context(),
		id,
		&api.GetFilesIdParams{}, //nolint:exhaustruct
	)
	if err != nil {
		return nil, fmt.Errorf("error downloading file: %w", err)
	}

	return sf, nil
}

func (r *Resolver) uploadOpenAIFile(
	c *gin.Context,
	body []byte,
	fileName string,
	logger *slog.Logger,
) (*oapi.CreateFileR, error) {
	f, err := r.ai.FilesCreate(
		c.Request.Context(),
		bytes.NewReader(body),
		fileName,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("error uploading file to openai: %w", err)
	}

	return f, nil
}

func (r *Resolver) addFileToVectorStores(
	c *gin.Context,
	vectorStoreIDs []string,
	fileID string,
) error {
	for _, id := range vectorStoreIDs {
		if _, err := r.ai.VectorStoresFilesCreate(
			c.Request.Context(),
			id,
			fileID,
		); err != nil {
			return fmt.Errorf("error adding file to vector store: %w", err)
		}
	}

	return nil
}

func (r *Resolver) deleteOpenAIFile(c *gin.Context, fileID string, logger *slog.Logger) error {
	if err := r.ai.FilesDelete(c.Request.Context(), fileID, logger); err != nil {
		return fmt.Errorf("error deleting file from openai: %w", err)
	}

	return nil
}

func (r *Resolver) updateGraphiteFile(c *gin.Context, fileID, etag string) error {
	if _, err := r.hasura.UpdateGraphiteFiles(
		c.Request.Context(),
		hasura.GraphiteFilesBoolExp{ //nolint:exhaustruct
			ID: &hasura.UUIDComparisonExp{ //nolint:exhaustruct
				Eq: new(fileID),
			},
		},
		hasura.GraphiteFilesSetInput{ //nolint:exhaustruct
			UpdatedAt: new(time.Now()),
			FileID:    new(fileID),
			Etag:      new(etag),
		},
		withRequestHeaders(c.Request.Header),
	); err != nil {
		return fmt.Errorf("error updating graphite file: %w", err)
	}

	return nil
}

func (r *Resolver) insertGraphiteFile(
	c *gin.Context,
	fileID, storageFileID, etag string,
) error {
	if _, err := r.hasura.InsertGraphiteFile(
		c.Request.Context(),
		hasura.GraphiteFilesInsertInput{ //nolint:exhaustruct
			FileID:        new(fileID),
			StorageFileID: new(storageFileID),
			Etag:          new(etag),
		},
		withRequestHeaders(c.Request.Header),
	); err != nil {
		return fmt.Errorf("error inserting graphite file: %w", err)
	}

	return nil
}

func (r *Resolver) upsertGraphiteFile(
	c *gin.Context,
	logger *slog.Logger,
	gFiles []*hasura.GetGraphiteFilesMetadata_GraphiteFiles,
	fileID, storageFileID, etag string,
) error {
	// file already uploaded but etag is different
	if len(gFiles) == 1 {
		if err := r.deleteOpenAIFile(c, gFiles[0].FileID, logger); err != nil {
			return err
		}

		logger.InfoContext(c.Request.Context(), "updating file metadata in graphite")

		return r.updateGraphiteFile(c, fileID, etag)
	}

	return r.insertGraphiteFile(c, fileID, storageFileID, etag)
}

func (r *Resolver) getStorageFileAndCheckSupport(
	c *gin.Context,
	fileID string,
) (*hasura.GetStorageFileMetadata_File, error) {
	resp, err := r.getStorageFile(c, fileID)
	if err != nil {
		return nil, err
	}

	if !isFileSupported(resp.GetFile()) {
		return nil, ErrFileNotSupported
	}

	return resp.GetFile(), nil
}

func (r *Resolver) getFileStoresUsingBucket(
	c *gin.Context,
	bucketID string,
) ([]string, error) {
	vss, err := r.getVectorStoreIDs(c, bucketID)
	if err != nil {
		return nil, err
	}

	if len(vss) == 0 {
		return nil, ErrFileStoresNotFound
	}

	return vss, nil
}

func (r *Resolver) uploadFileAndAddToVectorStores(
	c *gin.Context,
	logger *slog.Logger,
	fileID string,
	fileName string,
	vss []string,
) (*oapi.CreateFileR, error) {
	sf, err := r.downloadStorageFile(c, fileID)
	if err != nil {
		return nil, err
	}

	logger.InfoContext(c.Request.Context(), "uploading file to openai")

	f, err := r.uploadOpenAIFile(c, sf.Body, fileName, logger)
	if err != nil {
		return nil, err
	}

	return f, r.addFileToVectorStores(c, vss, f.JSON200.Id)
}

func (r *Resolver) handleUploadFile(
	e storageFileWebhookEvent,
	c *gin.Context,
) {
	logger := middleware.LoggerFromContext(c.Request.Context())
	fileID := e.Event.Data.New.ID
	fileName := e.Event.Data.New.Name

	sFile, err := r.getStorageFileAndCheckSupport(c, fileID)
	if err != nil {
		if errors.Is(err, ErrFileNotSupported) || errors.Is(err, ErrFileStoresNotFound) {
			c.JSON(http.StatusOK, gin.H{"message": err.Error()})
			return
		}

		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	vss, err := r.getFileStoresUsingBucket(c, sFile.GetBucket().GetID())
	if err != nil {
		webhookFail(c, http.StatusInternalServerError, err)
		return
	}

	gf, err := r.getGraphiteFile(c, fileID)
	if err != nil {
		webhookFail(c, http.StatusInternalServerError, err)
		return
	}

	if len(gf.GetGraphiteFiles()) == 1 {
		// file already uploaded, check for etag and ignore event if the same
		if f := gf.GetGraphiteFiles()[0]; f.Etag == e.Event.Data.New.Etag {
			c.JSON(
				http.StatusOK,
				gin.H{"message": "file exists and etag is the same, ignoring update event"},
			)

			return
		}
	}

	logger.InfoContext(c.Request.Context(), "processing file upload")

	f, err := r.uploadFileAndAddToVectorStores(c, logger, fileID, fileName, vss)
	if err != nil {
		webhookFail(c, http.StatusInternalServerError, err)
		return
	}

	logger.InfoContext(c.Request.Context(), "upserting file metadata in graphite")

	if err = r.upsertGraphiteFile(
		c,
		logger,
		gf.GetGraphiteFiles(),
		f.JSON200.Id,
		fileID,
		e.Event.Data.New.Etag,
	); err != nil {
		webhookFail(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file uploaded or updated successfully"})
}

func (r *Resolver) handleDeleteFile(e storageFileWebhookEvent, c *gin.Context) {
	logger := middleware.LoggerFromContext(c.Request.Context())

	id := e.Event.Data.Old.ID

	resp, err := r.hasura.GetStorageFileMetadata(c.Request.Context(), id)
	if err != nil {
		err := fmt.Errorf("error getting storage file metadata: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	if resp.GetFile() != nil {
		logger.InfoContext(c.Request.Context(), "file exists, ignoring delete event")
		c.JSON(http.StatusOK, gin.H{"message": "file exists, ignoring delete event"})

		return
	}

	gfm, err := r.hasura.GetGraphiteFilesMetadata(
		c.Request.Context(),
		&hasura.GraphiteFilesBoolExp{ //nolint: exhaustruct
			StorageFileID: &hasura.UUIDComparisonExp{ //nolint: exhaustruct
				Eq: new(id),
			},
		},
	)
	if err != nil {
		err := fmt.Errorf("error getting file: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	gf := gfm.GetGraphiteFiles()
	if len(gf) == 0 {
		logger.InfoContext(c.Request.Context(), "file not present in openai, ignoring delete event")
		c.JSON(
			http.StatusOK,
			gin.H{"message": "file not present in openai, ignoring delete event"},
		)

		return
	}

	logger.InfoContext(c.Request.Context(), "deleting file from graphite")

	if err = r.deleteOpenAIFile(c, gf[0].FileID, logger); err != nil {
		webhookFail(c, http.StatusInternalServerError, err)
		return
	}

	_, err = r.hasura.DeleteGraphiteFile(c.Request.Context(), gf[0].GetID())
	if err != nil {
		err := fmt.Errorf("error deleting file metadata from graphite: %w", err)
		webhookFail(c, http.StatusInternalServerError, err)

		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file deleted successfully"})
}
