package tools_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
	"github.com/nhost/nhost/services/mcp/tools"
)

func storageClient(t *testing.T, endpoint string) *client.Client {
	t.Helper()

	s := mcpserver.NewMCPServer("test", "test")
	if err := tools.RegisterStorage(s, endpoint); err != nil {
		t.Fatal(err)
	}

	c, err := client.NewInProcessClient(s)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { c.Close() })

	if err := c.Start(t.Context()); err != nil {
		t.Fatal(err)
	}

	req := mcp.InitializeRequest{}
	req.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
	req.Params.ClientInfo = mcp.Implementation{Name: "test", Version: "test"}

	if _, err := c.Initialize(t.Context(), req); err != nil {
		t.Fatal(err)
	}

	return c
}

func callStorageTool(
	t *testing.T, c *client.Client, name string, args map[string]any,
) *mcp.CallToolResult {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer storage-user")
	ctx := tools.AuthorizationToContext(t.Context(), req)
	call := mcp.CallToolRequest{}
	call.Params.Name = name
	call.Params.Arguments = args

	result, err := c.CallTool(ctx, call)
	if err != nil {
		t.Fatal(err)
	}

	return result
}

func storageFileArgs() map[string]any {
	return map[string]any{
		"name":        "photo.png",
		"data":        base64.StdEncoding.EncodeToString([]byte("image bytes")),
		"contentType": "image/png",
	}
}

func checkMultipart(t *testing.T, r *http.Request, field string, count int) {
	t.Helper()

	if err := r.ParseMultipartForm(1 << 20); err != nil {
		t.Error(err)
		return
	}

	defer func() {
		if err := r.MultipartForm.RemoveAll(); err != nil {
			t.Error(err)
		}
	}()

	files := r.MultipartForm.File[field]
	if len(files) != count {
		t.Errorf("got %d files under %q, want %d", len(files), field, count)
		return
	}

	for _, f := range files {
		if f.Filename != "photo.png" || f.Header.Get("Content-Type") != "image/png" {
			t.Errorf("unexpected file headers: %+v", f)
		}

		file, err := f.Open()
		if err != nil {
			t.Error(err)
			continue
		}

		data, err := io.ReadAll(file)
		if err != nil {
			t.Error(err)
		}

		if err := file.Close(); err != nil {
			t.Error(err)
		}

		if string(data) != "image bytes" {
			t.Errorf("unexpected file bytes: %q", data)
		}
	}
}

type storageTestCase struct {
	name    string
	tool    string
	args    map[string]any
	method  string
	path    string
	check   func(*testing.T, *http.Request)
	status  int
	body    string
	mime    string
	isError bool
	image   bool
}

func storageMetadataArgs() map[string]any {
	return map[string]any{
		"id": "custom-id", "name": "renamed.png",
		"metadata": map[string]any{"alt": "Photo", "nested": map[string]any{"value": true}},
	}
}

func TestStorageTools(t *testing.T) {
	t.Parallel()

	metadata := storageMetadataArgs()
	tests := []storageTestCase{
		{
			name: "batch upload with bucket and all metadata",
			tool: "storage-upload",
			args: map[string]any{
				"files":    []any{storageFileArgs(), storageFileArgs()},
				"bucketId": "images",
				"metadata": []any{metadata, map[string]any{}},
			},
			method: http.MethodPost,
			path:   "/v1/files",
			check:  checkBatchUpload,
			status: http.StatusCreated,
			body:   `{"processedFiles":[{"id":"custom-id","name":"renamed.png"}]}`,
			mime:   "application/json",
		},
		{
			name: "default upload without bucket or metadata",
			tool: "storage-upload",
			args: map[string]any{
				"files": []any{storageFileArgs()},
			},
			method: http.MethodPost,
			path:   "/v1/files",
			check:  checkDefaultUpload,
			status: http.StatusCreated,
			body:   `{"processedFiles":[{"id":"generated"}]}`,
			mime:   "application/json",
		},
		{
			name:   "empty upload without explicit MIME type",
			tool:   "storage-upload",
			args:   map[string]any{"files": []any{map[string]any{"name": "empty.bin", "data": ""}}},
			method: http.MethodPost,
			path:   "/v1/files",
			check:  checkEmptyUpload,
			status: http.StatusCreated,
			body:   `{"processedFiles":[{"id":"empty"}]}`,
			mime:   "application/json",
		},
		{
			name: "partial upload failure preserves processed files",
			tool: "storage-upload",
			args: map[string]any{
				"files": []any{storageFileArgs(), storageFileArgs()},
			},
			method:  http.MethodPost,
			path:    "/v1/files",
			status:  http.StatusForbidden,
			body:    `{"processedFiles":[{"id":"first"}],"error":{"message":"denied","data":{"file":"second"}}}`,
			mime:    "application/json",
			isError: true,
		},
		{
			name: "replacement with name and metadata",
			tool: "storage-update",
			args: map[string]any{
				"id":   "existing",
				"file": storageFileArgs(),
				"metadata": map[string]any{
					"name":     "replacement.png",
					"metadata": map[string]any{"alt": "New"},
				},
			},
			method: http.MethodPut,
			path:   "/v1/files/existing",
			check:  checkReplacement,
			status: http.StatusOK,
			body:   `{"id":"existing","name":"replacement.png"}`,
			mime:   "application/json",
		},
		{
			name: "replacement preserves explicit empty custom metadata",
			tool: "storage-update",
			args: map[string]any{
				"id":       "existing",
				"file":     storageFileArgs(),
				"metadata": map[string]any{"metadata": map[string]any{}},
			},
			method: http.MethodPut,
			path:   "/v1/files/existing",
			check:  checkEmptyReplacement,
			status: http.StatusOK,
			body:   `{"id":"existing","metadata":{}}`,
			mime:   "application/json",
		},
		{
			name: "replacement without metadata",
			tool: "storage-update",
			args: map[string]any{
				"id":   "existing",
				"file": storageFileArgs(),
			},
			method: http.MethodPut,
			path:   "/v1/files/existing",
			check:  checkReplacementWithoutMetadata,
			status: http.StatusOK,
			body:   `{"id":"existing"}`,
			mime:   "application/json",
		},
		{
			name: "download all transformation and conditional options",
			tool: "storage-download",
			args: map[string]any{
				"id":                "image",
				"q":                 90,
				"h":                 200,
				"w":                 300,
				"b":                 0,
				"f":                 "auto",
				"accept":            "image/webp",
				"range":             "bytes=0-9",
				"ifMatch":           `"etag"`,
				"ifNoneMatch":       `"other"`,
				"ifModifiedSince":   "Tue, 12 Aug 2025 12:03:50 GMT",
				"ifUnmodifiedSince": "Wed, 13 Aug 2025 12:03:50 GMT",
			},
			method: http.MethodGet,
			path:   "/v1/files/image",
			check:  checkDownloadOptions,
			status: http.StatusOK,
			body:   "image bytes",
			mime:   "image/webp",
			image:  true,
		},
		{
			name: "byte range preserves partial data and headers without image content",
			tool: "storage-download",
			args: map[string]any{
				"id":    "image",
				"range": "bytes=0-2",
			},
			method: http.MethodGet,
			path:   "/v1/files/image",
			status: http.StatusPartialContent,
			body:   "img",
			mime:   "image/png",
		},
		{
			name: "conditional not modified",
			tool: "storage-download",
			args: map[string]any{
				"id":          "image",
				"ifNoneMatch": `"etag"`,
			},
			method: http.MethodGet,
			path:   "/v1/files/image",
			status: http.StatusNotModified,
		},
		{
			name: "conditional precondition failure",
			tool: "storage-download",
			args: map[string]any{
				"id":      "image",
				"ifMatch": `"wrong"`,
			},
			method:  http.MethodGet,
			path:    "/v1/files/image",
			status:  http.StatusPreconditionFailed,
			isError: true,
		},
		{
			name: "binary non-image download",
			tool: "storage-download",
			args: map[string]any{
				"id": "document",
			},
			method: http.MethodGet,
			path:   "/v1/files/document",
			status: http.StatusOK,
			body:   "\x00\xffbinary",
			mime:   "application/octet-stream",
		},
		{
			name: "download error preserves X-Error and JSON body",
			tool: "storage-download",
			args: map[string]any{
				"id": "missing",
			},
			method:  http.MethodGet,
			path:    "/v1/files/missing",
			status:  http.StatusNotFound,
			body:    `{"error":{"message":"not found"}}`,
			mime:    "application/json",
			isError: true,
		},
		{
			name:   "delete",
			tool:   "storage-delete",
			args:   map[string]any{"id": "image"},
			method: http.MethodDelete,
			path:   "/v1/files/image",
			status: http.StatusNoContent,
		},
		{
			name:    "delete forbidden",
			tool:    "storage-delete",
			args:    map[string]any{"id": "image"},
			method:  http.MethodDelete,
			path:    "/v1/files/image",
			status:  http.StatusForbidden,
			body:    `{"error":{"message":"denied"}}`,
			mime:    "application/json",
			isError: true,
		},
		{
			name:    "non-JSON upstream failure is retained",
			tool:    "storage-delete",
			args:    map[string]any{"id": "image"},
			method:  http.MethodDelete,
			path:    "/v1/files/image",
			status:  http.StatusBadGateway,
			body:    "upstream unavailable",
			mime:    "text/plain",
			isError: true,
		},
		{
			name:   "escaped file ID cannot inject query or fragment",
			tool:   "storage-delete",
			args:   map[string]any{"id": "file?x=y#fragment"},
			method: http.MethodDelete,
			path:   "/v1/files/file?x=y#fragment",
			status: http.StatusNoContent,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			runStorageCase(t, tt)
		})
	}
}

func checkBatchUpload(t *testing.T, r *http.Request) {
	t.Helper()

	metadata := storageMetadataArgs()

	checkMultipart(t, r, "file[]", 2)

	if r.FormValue("bucket-id") != "images" {
		t.Error("bucket not forwarded")
	}

	values := r.MultipartForm.Value["metadata[]"]
	if len(values) != 2 {
		t.Errorf("missing metadata entries: %v", values)
		return
	}

	var got map[string]any
	if err := json.Unmarshal([]byte(values[0]), &got); err != nil {
		t.Error(err)
	}

	if diff := cmp.Diff(metadata, got); diff != "" {
		t.Error(diff)
	}

	if values[1] != "{}" {
		t.Errorf("empty metadata not preserved: %q", values[1])
	}
}

func checkDefaultUpload(t *testing.T, r *http.Request) {
	t.Helper()
	checkMultipart(t, r, "file[]", 1)

	if _, ok := r.MultipartForm.Value["bucket-id"]; ok {
		t.Error("default bucket must be left to storage")
	}

	if _, ok := r.MultipartForm.Value["metadata[]"]; ok {
		t.Error("metadata should be omitted")
	}
}

func checkEmptyUpload(t *testing.T, r *http.Request) {
	t.Helper()

	if err := r.ParseMultipartForm(1 << 20); err != nil {
		t.Error(err)
		return
	}

	defer func() {
		if err := r.MultipartForm.RemoveAll(); err != nil {
			t.Error(err)
		}
	}()

	files := r.MultipartForm.File["file[]"]
	if len(files) != 1 || files[0].Size != 0 ||
		files[0].Header.Get("Content-Type") != "application/octet-stream" {
		t.Errorf("incorrect empty-file upload: %+v", files)
	}
}

func checkReplacement(t *testing.T, r *http.Request) {
	t.Helper()
	checkMultipart(t, r, "file", 1)

	if got := r.FormValue(
		"metadata",
	); got != `{"name":"replacement.png","metadata":{"alt":"New"}}` {
		t.Errorf("replacement metadata mismatch: %s", got)
	}
}

func checkEmptyReplacement(t *testing.T, r *http.Request) {
	t.Helper()
	checkMultipart(t, r, "file", 1)

	if got := r.FormValue("metadata"); got != `{"metadata":{}}` {
		t.Errorf("explicit empty metadata lost: %s", got)
	}
}

func checkReplacementWithoutMetadata(t *testing.T, r *http.Request) {
	t.Helper()
	checkMultipart(t, r, "file", 1)

	if _, ok := r.MultipartForm.Value["metadata"]; ok {
		t.Error("metadata should be omitted")
	}
}

func checkDownloadOptions(t *testing.T, r *http.Request) {
	t.Helper()

	if r.URL.RawQuery != "b=0&f=auto&h=200&q=90&w=300" {
		t.Errorf("wrong transformation query: %s", r.URL.RawQuery)
	}

	for name, want := range map[string]string{
		"Accept": "image/webp", "Range": "bytes=0-9", "If-Match": `"etag"`, "If-None-Match": `"other"`,
		"If-Modified-Since": "Tue, 12 Aug 2025 12:03:50 GMT", "If-Unmodified-Since": "Wed, 13 Aug 2025 12:03:50 GMT",
	} {
		if got := r.Header.Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
}

func runStorageCase(t *testing.T, tt storageTestCase) {
	t.Helper()

	srv := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != tt.method || r.URL.Path != tt.path ||
				r.Header.Get("Authorization") != "Bearer storage-user" {
				t.Errorf(
					"unexpected request: %s %s auth=%q",
					r.Method,
					r.URL.Path,
					r.Header.Get("Authorization"),
				)
			}

			if tt.check != nil {
				tt.check(t, r)
			} else if r.URL.RawQuery != "" {
				t.Errorf("unexpected query: %s", r.URL.RawQuery)
			}

			w.Header().Set("Content-Type", tt.mime)
			w.Header().Set("ETag", `"etag"`)
			w.Header().Set("Cache-Control", "max-age=3600")
			w.Header().Set("Content-Range", "bytes 0-2/11")
			w.Header().Set("X-Error", "error details")
			w.WriteHeader(tt.status)

			if tt.body != "" {
				if _, err := io.WriteString(w, tt.body); err != nil {
					t.Error(err)
				}
			}
		}),
	)
	t.Cleanup(srv.Close)

	result := callStorageTool(t, storageClient(t, srv.URL+"/v1/"), tt.tool, tt.args)
	if result.IsError != tt.isError {
		t.Fatalf("IsError=%v, want %v: %+v", result.IsError, tt.isError, result)
	}

	checkStorageResult(t, result, tt)
}

func checkStorageResult(t *testing.T, result *mcp.CallToolResult, tt storageTestCase) {
	t.Helper()

	data, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}

	var response struct {
		StatusCode int             `json:"statusCode"`
		Headers    http.Header     `json:"headers"`
		Body       json.RawMessage `json:"body"`
		Data       *string         `json:"data"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatal(err)
	}

	if response.StatusCode != tt.status || response.Headers.Get("ETag") != `"etag"` ||
		response.Headers.Get("Cache-Control") != "max-age=3600" {
		t.Errorf("missing response details: %s", data)
	}

	if tt.tool == "storage-download" {
		if response.Data == nil ||
			*response.Data != base64.StdEncoding.EncodeToString([]byte(tt.body)) {
			t.Errorf("incorrect base64 download: %s", data)
		}

		if response.Headers.Get("Content-Range") != "bytes 0-2/11" ||
			response.Headers.Get("X-Error") != "error details" {
			t.Error("download headers lost")
		}
	}

	if json.Valid([]byte(tt.body)) {
		var wantBody, gotBody any
		if err := json.Unmarshal([]byte(tt.body), &wantBody); err != nil {
			t.Fatal(err)
		}

		if err := json.Unmarshal(response.Body, &gotBody); err != nil {
			t.Fatal(err)
		}

		if diff := cmp.Diff(wantBody, gotBody); diff != "" {
			t.Error(diff)
		}
	}

	checkStorageImage(t, result, tt)
}

func checkStorageImage(t *testing.T, result *mcp.CallToolResult, tt storageTestCase) {
	t.Helper()

	imageCount := 0
	for _, content := range result.Content {
		if image, ok := content.(mcp.ImageContent); ok {
			imageCount++

			if image.Data != base64.StdEncoding.EncodeToString([]byte(tt.body)) ||
				image.MIMEType != tt.mime {
				t.Errorf("incorrect MCP image: %+v", image)
			}
		}
	}

	if (imageCount == 1) != tt.image {
		t.Errorf("image content count=%d, want image=%v", imageCount, tt.image)
	}
}

func TestRegisterStorage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		endpoint string
		valid    bool
	}{
		{"https://backend.storage.example/v1", true},
		{"http://storage:5000/v1/", true},
		{"http://localhost:5000", true},
		{"", false},
		{"/v1", false},
		{"ftp://storage/v1", false},
		{"https://user:password@storage/v1", false},
		{"https://storage/v1?secret=value", false},
		{"https://storage/v1?", false},
		{"https://storage/v1#fragment", false},
		{"http://%zz", false},
	}

	for _, tt := range tests {
		t.Run(tt.endpoint, func(t *testing.T) {
			t.Parallel()

			s := mcpserver.NewMCPServer("test", "test")

			err := tools.RegisterStorage(s, tt.endpoint)
			if (err == nil) != tt.valid {
				t.Errorf("RegisterStorage() = %v, want valid=%v", err, tt.valid)
			}
		})
	}
}

func TestStorageToolSchemas(t *testing.T) {
	t.Parallel()

	c := storageClient(t, "https://storage.example/v1")

	result, err := c.ListTools(t.Context(), mcp.ListToolsRequest{})
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name        string
		properties  []string
		required    []string
		readOnly    bool
		destructive bool
		idempotent  bool
	}{
		{
			"storage-upload",
			[]string{"files", "bucketId", "metadata"},
			[]string{"files"},
			false,
			false,
			false,
		},
		{
			"storage-update",
			[]string{"id", "file", "metadata"},
			[]string{"id", "file"},
			false,
			true,
			false,
		},
		{
			"storage-download",
			[]string{
				"id",
				"q",
				"h",
				"w",
				"b",
				"f",
				"accept",
				"range",
				"ifMatch",
				"ifNoneMatch",
				"ifModifiedSince",
				"ifUnmodifiedSince",
			},
			[]string{"id"},
			true,
			false,
			true,
		},
		{"storage-delete", []string{"id"}, []string{"id"}, false, true, true},
	}

	if len(result.Tools) != len(tests) {
		t.Fatalf("got %d tools, want %d", len(result.Tools), len(tests))
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			index := slices.IndexFunc(
				result.Tools,
				func(tool mcp.Tool) bool { return tool.Name == tt.name },
			)
			if index == -1 {
				t.Fatal("tool not registered")
			}

			tool := result.Tools[index]
			if tool.Description == "" || tool.Annotations.Title == "" {
				t.Error("missing description or title")
			}

			wantAnnotations := mcp.ToolAnnotation{
				Title:           tool.Annotations.Title,
				ReadOnlyHint:    new(tt.readOnly),
				DestructiveHint: new(tt.destructive),
				IdempotentHint:  new(tt.idempotent),
				OpenWorldHint:   new(true),
			}
			if diff := cmp.Diff(wantAnnotations, tool.Annotations); diff != "" {
				t.Error(diff)
			}

			if len(tool.InputSchema.Properties) != len(tt.properties) ||
				!reflect.DeepEqual(tool.InputSchema.Required, tt.required) {
				t.Errorf("unexpected schema: %+v", tool.InputSchema)
			}

			for _, property := range tt.properties {
				if _, ok := tool.InputSchema.Properties[property]; !ok {
					t.Errorf("missing parameter %q", property)
				}
			}
		})
	}
}

func TestStorageInvalidInputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		tool string
		args map[string]any
	}{
		{"no files", "storage-upload", map[string]any{"files": []any{}}},
		{
			"metadata count",
			"storage-upload",
			map[string]any{
				"files":    []any{storageFileArgs(), storageFileArgs()},
				"metadata": []any{map[string]any{}},
			},
		},
		{
			"bad base64",
			"storage-upload",
			map[string]any{"files": []any{map[string]any{"name": "a.png", "data": "%%%"}}},
		},
		{
			"missing name",
			"storage-update",
			map[string]any{"id": "id", "file": map[string]any{"data": ""}},
		},
		{
			"bad MIME type",
			"storage-update",
			map[string]any{
				"id": "id",
				"file": map[string]any{
					"name":        "a.png",
					"data":        "",
					"contentType": "image/png\r\nInjected: true",
				},
			},
		},
		{"empty id", "storage-download", map[string]any{"id": ""}},
		{"path traversal", "storage-delete", map[string]any{"id": "../other"}},
		{"dot path", "storage-delete", map[string]any{"id": ".."}},
		{"slash", "storage-update", map[string]any{"id": "a/b", "file": storageFileArgs()}},
		{"backslash", "storage-download", map[string]any{"id": `a\b`}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
					t.Error("invalid input must not reach storage")
				}),
			)
			t.Cleanup(srv.Close)

			result := callStorageTool(t, storageClient(t, srv.URL), tt.tool, tt.args)
			if !result.IsError {
				t.Errorf("expected error for invalid input: %+v", result)
			}
		})
	}
}

func TestStorageDoesNotFollowRedirects(t *testing.T) {
	t.Parallel()

	target := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("must not follow storage redirects")
	}))
	t.Cleanup(target.Close)

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
	}))
	t.Cleanup(origin.Close)

	result := callStorageTool(
		t,
		storageClient(t, origin.URL),
		"storage-delete",
		map[string]any{"id": "id"},
	)
	if !result.IsError {
		t.Fatal("redirect should be reported, not followed")
	}
}

func TestStorageWithoutAuthorization(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Error("unexpected authorization")
		}

		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(srv.Close)

	c := storageClient(t, srv.URL)
	req := mcp.CallToolRequest{}
	req.Params.Name = "storage-delete"
	req.Params.Arguments = map[string]any{"id": "id"}

	if result, err := c.CallTool(t.Context(), req); err != nil || result.IsError {
		t.Fatalf("unexpected failure: %v, %+v", err, result)
	}
}

func TestStorageCancellation(t *testing.T) {
	t.Parallel()

	c := storageClient(t, "http://localhost:1/v1")
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	req := mcp.CallToolRequest{}
	req.Params.Name = "storage-download"
	req.Params.Arguments = map[string]any{"id": "id"}

	result, err := c.CallTool(ctx, req)
	if err == nil && !result.IsError {
		t.Error("cancellation must not succeed")
	}
}

func TestStorageTruncatedResponse(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "100")

		if _, err := io.WriteString(w, "short"); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(srv.Close)

	result := callStorageTool(
		t,
		storageClient(t, srv.URL),
		"storage-download",
		map[string]any{"id": "id"},
	)
	if !result.IsError ||
		!strings.Contains(fmt.Sprint(result.Content), "reading storage response") {
		t.Errorf("truncated response should fail: %+v", result)
	}
}

func TestStorageTransportFailure(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {}))
	srv.Close()

	result := callStorageTool(
		t,
		storageClient(t, srv.URL),
		"storage-download",
		map[string]any{"id": "id"},
	)
	if !result.IsError || !strings.Contains(fmt.Sprint(result.Content), "calling storage service") {
		t.Errorf("missing transport error: %+v", result)
	}
}
