package cmd

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"

	"github.com/gin-gonic/gin"
	metadataapi "github.com/nhost/nhost/services/constellation/api/metadata"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type (
	rawBodyCtxKey        struct{}
	inboundRequestCtxKey struct{}
)

// metadataMaxBodyBytes caps the request body read by captureRawBody. The
// middleware runs before the admin-secret check, so an unbounded read here
// would let unauthenticated clients force the server to buffer arbitrary
// payloads in memory. 10 MiB matches the GraphQL default and comfortably
// covers realistic replace_metadata payloads.
const metadataMaxBodyBytes int64 = 10 * 1024 * 1024

// captureRawBody is a gin middleware that reads c.Request.Body once, restores
// it so downstream handlers can decode normally, and stashes both the raw
// bytes and the inbound *http.Request in the request's context.
//
// This is wired in front of the /v1/metadata strict handler so the proxy
// fallback branch can forward the original byte stream and preserve fields
// the generated MetadataRequest model does not capture (e.g. unknown keys,
// number formatting), and so client cancellation/tracing on the inbound
// request propagates to the upstream Hasura call.
var (
	errMetadataBodyUnreadable = errors.New("failed to read metadata request body")
	errMetadataBodyTooLarge   = errors.New("metadata request body too large")
)

func captureRawBody(c *gin.Context) {
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

const metadataAdminSecretHeader = "X-Hasura-Admin-Secret" //nolint:gosec // header name, not a credential

// metadataServer implements the Hasura-compatible /v1/metadata API surface.
//
// Auth: the handler enforces X-Hasura-Admin-Secret directly rather than via
// the Session middleware so JWT-admin tokens do not satisfy /v1/metadata —
// see METADATA.md §3.1 ("pure admin, no JWT fallback").
//
// Dispatch: step 1 has no native ops, so every authenticated request falls
// through to the Hasura reverse proxy (when --hasura-upstream-url is
// configured), preserving the staggered-migration goal of "point everything
// at Constellation; unimplemented ops still reach Hasura". With no upstream
// configured, ops return `not-supported`. As native handlers land in later
// steps the dispatcher switches on req.Body.Type before falling through.
type metadataServer struct {
	adminSecret string
	proxy       *httputil.ReverseProxy
	source      metadata.Source
}

// metadataOpExportMetadata is the Hasura op type that returns the full
// metadata blob. See METADATA.md §2.1 — the v2 response shape is
// `{resource_version, metadata: {...}}`.
const metadataOpExportMetadata = "export_metadata"

func (s *metadataServer) MetadataRequest( //nolint:ireturn
	ctx context.Context, req metadataapi.MetadataRequestRequestObject,
) (metadataapi.MetadataRequestResponseObject, error) {
	if !s.isAdmin(ctx) {
		return metadataErrorResponse(
			//nolint:exhaustruct // type marker only; metadataErrorResponse fills the body
			metadataapi.MetadataRequest401JSONResponse{},
			"access-denied",
			"valid X-Hasura-Admin-Secret required",
			"$",
		), nil
	}

	if req.Body == nil {
		return metadataErrorResponse(
			//nolint:exhaustruct // type marker only; metadataErrorResponse fills the body
			metadataapi.MetadataRequest400JSONResponse{},
			"parse-failed",
			"request body is required",
			"$",
		), nil
	}

	if req.Body.Type == metadataOpExportMetadata {
		return s.exportMetadata()
	}

	if s.proxy == nil {
		return metadataErrorResponse(
			//nolint:exhaustruct // type marker only; metadataErrorResponse fills the body
			metadataapi.MetadataRequest400JSONResponse{},
			"not-supported",
			fmt.Sprintf(
				"metadata operation %q is not yet implemented and no Hasura upstream is configured",
				req.Body.Type,
			),
			"$.args",
		), nil
	}

	return metadataProxyResponse{
		proxy:   s.proxy,
		inbound: inboundRequestFromContext(ctx),
		raw:     rawBodyFromContext(ctx),
	}, nil
}

// exportMetadata returns the v2 `{resource_version, metadata: {...}}` envelope
// over the Hasura snapshot held by the metadata Source. Round-tripped through
// MarshalHasura, so envelope-level and per-struct unknown fields the engine
// does not model are preserved.
//
//nolint:ireturn // generated strict-handler API requires returning the response interface
func (s *metadataServer) exportMetadata() (metadataapi.MetadataRequestResponseObject, error) {
	var (
		raw     []byte
		version int64
	)

	if s.source != nil {
		raw, version = s.source.HasuraSnapshotJSON()
	}

	if raw == nil {
		// No Hasura-format snapshot available (e.g. file source loaded TOML
		// or InitialLoad has not run yet). Return an empty v3 envelope so
		// the dashboard sees "no tracked tables" rather than a 5xx.
		raw = []byte(`{"version":3,"sources":[]}`)
	}

	return metadataapi.MetadataRequest200JSONResponse{
		"resource_version": version,
		"metadata":         json.RawMessage(raw),
	}, nil
}

func (s *metadataServer) isAdmin(ctx context.Context) bool {
	if s.adminSecret == "" {
		return false
	}

	headers := requestcontext.ClientHeadersFromContext(ctx)
	if headers == nil {
		return false
	}

	provided := headers.Get(metadataAdminSecretHeader)

	return subtle.ConstantTimeCompare([]byte(s.adminSecret), []byte(provided)) == 1
}

// metadataProxyResponse forwards the inbound request byte-for-byte to the
// configured Hasura upstream. Implements metadataapi.MetadataRequestResponseObject
// so it can be returned from MetadataRequest like any other response variant —
// the strict-server invokes Visit, which then drives the reverse proxy.
//
// inbound is the original *http.Request captured by captureRawBody, used so
// the proxy sees the same URL, query, headers, and request context (incl.
// cancellation/tracing) the client supplied. raw is the original request body
// bytes; the *http.Request's own Body was drained by the strict handler.
type metadataProxyResponse struct {
	proxy   *httputil.ReverseProxy
	inbound *http.Request
	raw     []byte
}

var errMetadataProxyMissingRequest = errors.New(
	"metadata proxy: inbound request not captured (captureRawBody middleware not wired)",
)

func (r metadataProxyResponse) VisitMetadataRequestResponse(w http.ResponseWriter) error {
	if r.inbound == nil {
		return errMetadataProxyMissingRequest
	}

	proxyReq := r.inbound.Clone(r.inbound.Context())
	proxyReq.Body = io.NopCloser(bytes.NewReader(r.raw))
	proxyReq.ContentLength = int64(len(r.raw))
	// httputil.ReverseProxy rejects requests with a populated RequestURI;
	// it is a server-side field that does not apply to outbound requests.
	proxyReq.RequestURI = ""

	r.proxy.ServeHTTP(w, proxyReq)

	return nil
}

// metadataErrorResponse builds the Hasura-shape `{code, error, path}` body for
// either the 400 or 401 response variant. The variant is selected by the
// concrete type of `template`.
func metadataErrorResponse( //nolint:ireturn
	template metadataapi.MetadataRequestResponseObject,
	code, message, path string,
) metadataapi.MetadataRequestResponseObject {
	body := metadataapi.MetadataError{
		Code:     code,
		Error:    message,
		Path:     &path,
		Internal: nil,
	}

	switch template.(type) {
	case metadataapi.MetadataRequest400JSONResponse:
		return metadataapi.MetadataRequest400JSONResponse(body)
	case metadataapi.MetadataRequest401JSONResponse:
		return metadataapi.MetadataRequest401JSONResponse(body)
	default:
		return metadataapi.MetadataRequest400JSONResponse(body)
	}
}
