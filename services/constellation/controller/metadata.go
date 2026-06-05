package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/api"
)

type (
	rawBodyCtxKey        struct{}
	inboundRequestCtxKey struct{}
)

const metadataMaxBodyBytes int64 = 10 * 1024 * 1024

var (
	errMetadataBodyUnreadable = errors.New("failed to read metadata request body")
	errMetadataBodyTooLarge   = errors.New("metadata request body too large")
)

// CaptureRawBody is gin middleware that, for POST /v1/metadata only, reads
// the request body up to a fixed size limit, restores it for downstream
// handlers, and stashes the raw bytes plus the original *http.Request in
// the request context. The /v1/metadata dispatcher consumes the captured
// bytes when falling back to the Hasura upstream proxy.
//
// Only POST /v1/metadata is matched: the same merged api router also serves
// /healthz and /v1/version, which have no body and don't need this work.
func CaptureRawBody(c *gin.Context) {
	if c.Request.Method != http.MethodPost || c.Request.URL.Path != "/v1/metadata" {
		return
	}

	if c.Request.ContentLength > metadataMaxBodyBytes {
		_ = c.Error(
			fmt.Errorf("%w: limit is %d bytes", errMetadataBodyTooLarge, metadataMaxBodyBytes),
		)
		c.AbortWithStatus(http.StatusRequestEntityTooLarge)

		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, metadataMaxBodyBytes)

	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			_ = c.Error(
				fmt.Errorf("%w: limit is %d bytes", errMetadataBodyTooLarge, metadataMaxBodyBytes),
			)
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)

			return
		}

		_ = c.Error(fmt.Errorf("%w: %w", errMetadataBodyUnreadable, err))
		c.AbortWithStatus(http.StatusBadRequest)

		return
	}

	c.Request.Body = io.NopCloser(bytes.NewReader(raw))

	ctx := c.Request.Context()
	ctx = context.WithValue(ctx, rawBodyCtxKey{}, raw)
	ctx = context.WithValue(ctx, inboundRequestCtxKey{}, c.Request)
	c.Request = c.Request.WithContext(ctx)
}

func rawBodyFromContext(ctx context.Context) []byte {
	raw, _ := ctx.Value(rawBodyCtxKey{}).([]byte)

	return raw
}

func inboundRequestFromContext(ctx context.Context) *http.Request {
	req, _ := ctx.Value(inboundRequestCtxKey{}).(*http.Request)

	return req
}

const metadataOpExportMetadata = "export_metadata"

// MetadataRequest implements api.StrictServerInterface for /v1/metadata.
// Admin-secret enforcement is handled upstream by the security middleware
// (see NewSecurityMiddleware) which honours the spec's `security:` block.
func (c *Controller) MetadataRequest( //nolint:ireturn
	ctx context.Context, req api.MetadataRequestRequestObject,
) (api.MetadataRequestResponseObject, error) {
	if req.Body == nil {
		return metadataErrorResponse(
			"parse-failed",
			"request body is required",
			"$",
		), nil
	}

	if req.Body.Type == metadataOpExportMetadata {
		return c.exportMetadata()
	}

	if c.hasuraProxy == nil {
		return metadataErrorResponse(
			"not-supported",
			fmt.Sprintf(
				"metadata operation %q is not yet implemented and no Hasura upstream is configured",
				req.Body.Type,
			),
			"$.args",
		), nil
	}

	return metadataProxyResponse{
		proxy:   c.hasuraProxy,
		inbound: inboundRequestFromContext(ctx),
		raw:     rawBodyFromContext(ctx),
	}, nil
}

func (c *Controller) exportMetadata() (api.MetadataRequestResponseObject, error) { //nolint:ireturn
	var (
		raw     []byte
		version int64
	)

	if c.source != nil {
		raw, version = c.source.HasuraSnapshotJSON()
	}

	if raw == nil {
		raw = []byte(`{"version":3,"sources":[]}`)
	}

	return api.MetadataRequest200JSONResponse{
		"resource_version": version,
		"metadata":         json.RawMessage(raw),
	}, nil
}

type metadataProxyResponse struct {
	proxy   http.Handler
	inbound *http.Request
	raw     []byte
}

var errMetadataProxyMissingRequest = errors.New(
	"metadata proxy: inbound request not captured (CaptureRawBody middleware not wired)",
)

func (r metadataProxyResponse) VisitMetadataRequestResponse(w http.ResponseWriter) error {
	if r.inbound == nil {
		return errMetadataProxyMissingRequest
	}

	proxyReq := r.inbound.Clone(r.inbound.Context())
	proxyReq.Body = io.NopCloser(bytes.NewReader(r.raw))
	proxyReq.ContentLength = int64(len(r.raw))
	proxyReq.RequestURI = ""

	r.proxy.ServeHTTP(w, proxyReq)

	return nil
}

// metadataErrorResponse builds a 400 response with the canonical
// MetadataError body. 401s are produced upstream by the security middleware
// (see NewAuthFunc), never by this handler, so the only error shape the
// dispatcher itself emits is a 400.
func metadataErrorResponse( //nolint:ireturn
	code, message, path string,
) api.MetadataRequestResponseObject {
	return api.MetadataRequest400JSONResponse(api.MetadataError{
		Code:     code,
		Error:    message,
		Path:     &path,
		Internal: nil,
	})
}
