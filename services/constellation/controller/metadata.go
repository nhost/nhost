package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/metadata/source"
)

type (
	rawBodyCtxKey        struct{}
	inboundRequestCtxKey struct{}
)

var (
	errMetadataBodyUnreadable = errors.New("failed to read metadata request body")
	errMetadataBodyTooLarge   = errors.New("metadata request body too large")
)

// NewCaptureRawBody returns gin middleware that, for POST /v1/metadata only,
// requires a valid admin secret, reads the request body up to maxBodyBytes,
// restores it for downstream handlers, and stashes the raw bytes plus the
// original *http.Request in the request context. The /v1/metadata dispatcher
// consumes the captured bytes when falling back to the Hasura upstream proxy.
//
// maxBodyBytes <= 0 disables the cap (matching the proxy NoRoute path's
// flag semantics). The cap applies to every /v1/metadata request body:
// native mutation ops handled in-process by the Store (replace_metadata,
// bulk, pg_* writes, …) as well as ops forwarded to the Hasura upstream
// proxy. Its size is governed by --hasura-proxy-request-body-limit-bytes,
// so the cap MUST agree with the proxy fallback's cap.
//
// Only POST /v1/metadata is matched: the same merged api router also serves
// /healthz and /v1/version, which have no body and don't need this work.
func NewCaptureRawBody(maxBodyBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost || c.Request.URL.Path != "/v1/metadata" {
			return
		}

		// Authenticate before anything else so an unauthenticated caller always
		// gets 401 and never learns the configured body limit (no 413-vs-401
		// probing of an admin-only endpoint). The admin-secret check only reads
		// the already-resolved session from context — it does not touch the body,
		// so the DoS-avoidance goal (never read/allocate an unauthenticated body)
		// holds: the ContentLength comparison and io.ReadAll both run only after
		// this check passes.
		session := middleware.SessionFromContext(c.Request.Context())
		if session == nil || !session.IsAdminSecret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":          "unauthorized",
				"reason":         "admin secret required",
				"securityScheme": securitySchemeAdminSecret,
			})

			return
		}

		if maxBodyBytes > 0 && c.Request.ContentLength > maxBodyBytes {
			_ = c.Error(
				fmt.Errorf("%w: limit is %d bytes", errMetadataBodyTooLarge, maxBodyBytes),
			)
			c.AbortWithStatus(http.StatusRequestEntityTooLarge)

			return
		}

		if maxBodyBytes > 0 {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
		}

		raw, err := io.ReadAll(c.Request.Body)
		if err != nil {
			if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
				_ = c.Error(
					fmt.Errorf("%w: limit is %d bytes", errMetadataBodyTooLarge, maxBodyBytes),
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
		)
	}

	// When there is no in-process Store, a configured proxy owns ALL metadata
	// ops — including export_metadata, which must proxy so the client never
	// reads a stale local snapshot after its own proxied write (the
	// export -> edit -> replace optimistic-concurrency cycle). When a Store IS
	// present it is the source of truth: export, mutations, and snapshot ops are
	// served natively below and the proxy is only a per-op fallback for ops with
	// no native handler.
	if c.store == nil && c.hasuraProxy != nil {
		return metadataProxyResponse{
			proxy:   c.hasuraProxy,
			inbound: inboundRequestFromContext(ctx),
			raw:     rawBodyFromContext(ctx),
			store:   c.store,
			logger:  c.logger,
		}, nil
	}

	if req.Body.Type == metadataOpExportMetadata {
		return c.exportMetadata()
	}

	if resp, handled, err := c.dispatchMutation(ctx, req); handled {
		return resp, err
	}

	// No native handler: fall through to the proxy if configured, else
	// not-supported.
	if c.hasuraProxy != nil {
		return metadataProxyResponse{
			proxy:   c.hasuraProxy,
			inbound: inboundRequestFromContext(ctx),
			raw:     rawBodyFromContext(ctx),
			store:   c.store,
			logger:  c.logger,
		}, nil
	}

	return metadataErrorResponse(
		"not-supported",
		fmt.Sprintf(
			"metadata operation %q is not yet implemented and no Hasura upstream is configured",
			req.Body.Type,
		),
		"$.args",
	)
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
	// store, when non-nil, is reconciled from the database after the proxied
	// op so its native snapshot reflects the upstream's write to the shared
	// hdb_metadata. Nil in all-proxy (no Store) mode.
	store  *source.Store
	logger *slog.Logger
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

	// The upstream wrote to the shared hdb_metadata; refresh the in-process
	// store so its native snapshot (and export_metadata) reflects the proxied
	// change and peer replicas are notified. Detached from the request context
	// so the reconcile read is not aborted as the response completes.
	if r.store != nil {
		ctx := context.WithoutCancel(r.inbound.Context())
		if err := r.store.ReconcileAfterProxy(ctx); err != nil && r.logger != nil {
			r.logger.ErrorContext(
				ctx, "reconciling metadata store after proxied write failed", "error", err,
			)
		}
	}

	return nil
}

// metadataBulkArrayResponse is the success body for `bulk` / `bulk_keep_going`:
// a bare top-level JSON array of per-child results, matching Hasura's wire
// shape. The generated api.MetadataRequest200JSONResponse is a
// map[string]interface{} and cannot represent a bare array, so this hand-written
// response type implements the response interface directly.
type metadataBulkArrayResponse []any

func (r metadataBulkArrayResponse) VisitMetadataRequestResponse(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode([]any(r)); err != nil {
		return fmt.Errorf("encoding bulk metadata response: %w", err)
	}

	return nil
}

// metadataErrorResponse builds a 400 response with the canonical
// MetadataError body. 401s are produced upstream by the security middleware
// (see NewAuthFunc), never by this handler, so the only error shape the
// dispatcher itself emits is a 400.
func metadataErrorResponse( //nolint:ireturn
	code, message, path string,
) (api.MetadataRequestResponseObject, error) {
	response := api.MetadataRequest400JSONResponse{}
	if err := response.FromMetadataError(api.MetadataError{
		Code:     code,
		Error:    message,
		Path:     &path,
		Internal: nil,
	}); err != nil {
		return nil, fmt.Errorf("encoding metadata error response: %w", err)
	}

	return response, nil
}

// handledError adapts metadataErrorResponse to the (response, handled, err)
// shape the native dispatchers return: the request was handled, the body is a
// 400, and any encoding failure is propagated as a Go error rather than
// swallowed.
func handledError( //nolint:ireturn
	code, message, path string,
) (api.MetadataRequestResponseObject, bool, error) {
	resp, err := metadataErrorResponse(code, message, path)

	return resp, true, err
}
