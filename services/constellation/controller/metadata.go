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
	"github.com/nhost/nhost/services/constellation/controller/middleware"
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
// flag semantics). The cap MUST agree with the proxy fallback's cap: native
// export_metadata has no real body, so the only request bodies hitting this
// middleware are proxied ops (replace_metadata, bulk, …) whose acceptable
// size is governed by --hasura-proxy-request-body-limit-bytes.
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

const (
	metadataOpExportMetadata          = "export_metadata"
	metadataOpGetInconsistentMetadata = "get_inconsistent_metadata"
)

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

	// When a Hasura upstream is configured, every op — including
	// export_metadata — is proxied to it. Serving export_metadata from
	// the local cache while other ops (replace_metadata, pg_track_table, …)
	// mutate Hasura via the proxy would let a client read a stale snapshot
	// after its own write, breaking the export→edit→replace optimistic-
	// concurrency cycle the CLI/dashboard rely on (stale resource_version
	// → 409 conflict on the next replace).
	if c.hasuraProxy != nil {
		return metadataProxyResponse{
			proxy:   c.hasuraProxy,
			inbound: inboundRequestFromContext(ctx),
			raw:     rawBodyFromContext(ctx),
		}, nil
	}

	if req.Body.Type == metadataOpExportMetadata {
		return c.exportMetadata()
	}

	if req.Body.Type == metadataOpGetInconsistentMetadata {
		return c.getInconsistentMetadata()
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

// getInconsistentMetadata answers Hasura's get_inconsistent_metadata from the
// inconsistencies recorded during the most recent build (Controller.Inconsistencies()).
// Unlike Hasura, Constellation accepts metadata that fails validation and records
// it as an inconsistency at build time rather than rejecting the write inline, so
// this is how those failures (e.g. an action referencing an undefined output type)
// become visible.
func (c *Controller) getInconsistentMetadata() (api.MetadataRequestResponseObject, error) { //nolint:ireturn
	inc := c.Inconsistencies()

	// Hasura's get_inconsistent_metadata returns a "definition" key holding the
	// offending entity's metadata definition object. Constellation's
	// Inconsistency only records type/name/reason, so rather than emit a
	// misleading "definition" that merely duplicates "name", the key is omitted;
	// Hasura-compatible clients (console/dashboard) key off type/name/reason and
	// tolerate its absence.
	objects := make([]map[string]any, 0, len(inc))
	for i := range inc {
		objects = append(objects, map[string]any{
			"type":   inc[i].Kind,
			"name":   inc[i].Name,
			"reason": inc[i].Reason,
		})
	}

	return api.MetadataRequest200JSONResponse{
		"is_consistent":        len(objects) == 0,
		"inconsistent_objects": objects,
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
func metadataErrorResponse(
	code, message, path string,
) (api.MetadataRequest400JSONResponse, error) {
	response := api.MetadataRequest400JSONResponse{}

	err := response.FromMetadataError(api.MetadataError{
		Code:     code,
		Error:    message,
		Path:     &path,
		Internal: nil,
	})
	if err != nil {
		return api.MetadataRequest400JSONResponse{}, fmt.Errorf(
			"building metadata error response: %w",
			err,
		)
	}

	return response, nil
}
