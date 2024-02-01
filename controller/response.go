package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func timeFromRFC3339ToRFC1123(t string) (string, *APIError) {
	datetime, err := time.Parse(time.RFC3339, t)
	if err != nil {
		return "", InternalServerError(err)
	}
	return datetime.Format(time.RFC1123), nil
}

type FileResponse struct {
	fileID                      string
	contentType                 string
	contentLength               int64
	etag                        string
	cacheControl                string
	lastModified                string
	statusCode                  int
	body                        io.ReadCloser
	name                        string
	headers                     http.Header
	disableSurrageControlHeader bool
}

func NewFileResponse(
	fileID string,
	contentType string,
	contentLength int64,
	etag string,
	cacheControl string,
	lastModified string,
	statusCode int,
	reader io.ReadCloser,
	name string,
	headers http.Header,
) *FileResponse {
	return &FileResponse{
		fileID:        fileID,
		contentType:   contentType,
		contentLength: contentLength,
		etag:          etag,
		cacheControl:  cacheControl,
		lastModified:  lastModified,
		statusCode:    statusCode,
		body:          reader,
		name:          name,
		headers:       headers,
	}
}

func (r *FileResponse) Write(ctx *gin.Context) {
	ctx.Writer.WriteHeader(r.statusCode)

	for k, v := range r.headers {
		for _, vv := range v {
			ctx.Writer.Header().Add(k, vv)
		}
	}

	if r.statusCode != http.StatusNotModified {
		// https://www.rfc-editor.org/rfc/rfc7232#section-4.1
		ctx.Header("Content-Length", strconv.FormatInt(r.contentLength, 10))
		ctx.Header("Content-Type", r.contentType)
		ctx.Header("Surrogate-Key", r.fileID)
		ctx.Header("Last-modified", r.lastModified)
	}

	if !r.disableSurrageControlHeader {
		ctx.Header("Surrogate-Control", "max-age=604800")
	}
	ctx.Header("Cache-Control", r.cacheControl)
	ctx.Header("Etag", r.etag)

	if r.body != nil &&
		(r.statusCode == http.StatusOK || r.statusCode == http.StatusPartialContent) {
		ctx.Writer.Header().
			Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, url.QueryEscape(r.name)))

		_, err := io.Copy(ctx.Writer, r.body)
		if err != nil {
			_ = ctx.Error(fmt.Errorf("problem writing response: %w", err))
		}
	}
}
