package storage //nolint:testpackage // tests need access to unexported helpers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const (
	testFilePerm = 0o644
	testDirPerm  = 0o755
)

func newRawResponse(status int, body string) *http.Response {
	rec := httptest.NewRecorder()
	rec.WriteHeader(status)
	_, _ = rec.WriteString(body)

	return rec.Result()
}

func TestParseListFilesResponse(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		status     int
		body       string
		want       []fileSummary
		wantErr    error
		wantErrSub string
	}{
		{
			name:   "success with files",
			status: http.StatusOK,
			body: `{"data":{"files":[` +
				`{"id":"abc","name":"a.txt"},` +
				`{"id":"def","name":"d.bin"}` +
				`]}}`,
			want: []fileSummary{
				{ID: "abc", Name: "a.txt"},
				{ID: "def", Name: "d.bin"},
			},
			wantErr:    nil,
			wantErrSub: "",
		},
		{
			name:       "empty data.files",
			status:     http.StatusOK,
			body:       `{"data":{"files":[]}}`,
			want:       nil,
			wantErr:    nil,
			wantErrSub: "",
		},
		{
			name:       "non-200 status",
			status:     http.StatusInternalServerError,
			body:       `boom`,
			want:       nil,
			wantErr:    errGraphqlRequest,
			wantErrSub: "",
		},
		{
			name:       "malformed JSON",
			status:     http.StatusOK,
			body:       `{"data": not-json`,
			want:       nil,
			wantErr:    nil,
			wantErrSub: "failed to decode graphql response",
		},
		{
			name:       "graphql errors payload",
			status:     http.StatusOK,
			body:       `{"errors":[{"message":"bad"},{"message":"worse"}]}`,
			want:       nil,
			wantErr:    errGraphqlResponse,
			wantErrSub: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			resp := newRawResponse(tc.status, tc.body)
			defer resp.Body.Close()

			got, err := parseListFilesResponse(resp)

			switch {
			case tc.wantErr != nil:
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
			case tc.wantErrSub != "":
				if err == nil || !strings.Contains(err.Error(), tc.wantErrSub) {
					t.Fatalf("expected error containing %q, got %v", tc.wantErrSub, err)
				}
			default:
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if diff := cmp.Diff(tc.want, got, cmpopts.EquateEmpty()); diff != "" {
					t.Fatalf("files mismatch (-want +got):\n%s", diff)
				}
			}
		})
	}
}

func newTestCliEnv(nhostFolder, localSubdomain string) *clienv.CliEnv {
	return clienv.New(
		io.Discard,
		io.Discard,
		clienv.NewPathStructure("", "", "", nhostFolder),
		"", "", "", "", "",
		"test-project",
		localSubdomain,
		false,
	)
}

func TestResolveEndpointsLocal(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name           string
		args           []string
		localSubdomain string
		want           *endpoints
	}{
		{
			name: "tls default port",
			args: []string{
				"app",
				"--subdomain=local",
				"--admin-secret=hush",
			},
			localSubdomain: "abc",
			want: &endpoints{
				storage:     "https://abc.storage.local.nhost.run/v1",
				graphql:     "https://abc.graphql.local.nhost.run/v1",
				adminSecret: "hush",
			},
		},
		{
			name: "no tls custom port",
			args: []string{
				"app",
				"--subdomain=local",
				"--admin-secret=hush",
				"--http-port=8080",
				"--disable-tls",
			},
			localSubdomain: "abc",
			want: &endpoints{
				storage:     "http://abc.storage.local.nhost.run:8080/v1",
				graphql:     "http://abc.graphql.local.nhost.run:8080/v1",
				adminSecret: "hush",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ce := newTestCliEnv("", tc.localSubdomain)

			var got *endpoints

			cmd := &cli.Command{ //nolint:exhaustruct
				Name:  "app",
				Flags: commonFlags(),
				Action: func(ctx context.Context, cmd *cli.Command) error {
					var err error

					got, err = resolveEndpoints(ctx, ce, cmd)

					return err
				},
			}

			if err := cmd.Run(t.Context(), tc.args); err != nil {
				t.Fatalf("Run failed: %v", err)
			}

			var probe endpoints
			if diff := cmp.Diff(tc.want, got, cmp.AllowUnexported(probe)); diff != "" {
				t.Fatalf("endpoints mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type fakeStorage struct {
	server *httptest.Server

	bucketFiles map[string][]fileSummary
	failIDs     map[string]bool
	putDelay    time.Duration

	mu          sync.Mutex
	uploaded    map[string][]byte
	inFlight    atomic.Int32
	maxInFlight atomic.Int32
}

func newFakeStorage(t *testing.T) *fakeStorage {
	t.Helper()

	fs := &fakeStorage{
		server:      nil,
		bucketFiles: map[string][]fileSummary{},
		failIDs:     map[string]bool{},
		putDelay:    0,
		mu:          sync.Mutex{},
		uploaded:    map[string][]byte{},
		inFlight:    atomic.Int32{},
		maxInFlight: atomic.Int32{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /graphql/v1", fs.handleGraphQL)
	mux.HandleFunc("PUT /storage/v1/files/{id}", fs.handlePut)

	fs.server = httptest.NewServer(mux)
	t.Cleanup(fs.server.Close)

	return fs
}

func (fs *fakeStorage) graphqlURL() string { return fs.server.URL + "/graphql/v1" }
func (fs *fakeStorage) storageURL() string { return fs.server.URL + "/storage/v1" }

func (fs *fakeStorage) handleGraphQL(w http.ResponseWriter, r *http.Request) {
	if got := r.Header.Get(adminSecretHeader); got == "" {
		http.Error(w, "missing admin secret", http.StatusUnauthorized)

		return
	}

	var req struct {
		Variables struct {
			BucketID string `json:"bucketID"`
		} `json:"variables"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)

		return
	}

	resp := listFilesResponse{
		Data: struct {
			Files []fileSummary `json:"files"`
		}{Files: fs.bucketFiles[req.Variables.BucketID]},
		Errors: nil,
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (fs *fakeStorage) handlePut(w http.ResponseWriter, r *http.Request) {
	cur := fs.inFlight.Add(1)
	defer fs.inFlight.Add(-1)

	for {
		prev := fs.maxInFlight.Load()
		if cur <= prev || fs.maxInFlight.CompareAndSwap(prev, cur) {
			break
		}
	}

	if fs.putDelay > 0 {
		time.Sleep(fs.putDelay)
	}

	if got := r.Header.Get(adminSecretHeader); got == "" {
		http.Error(w, "missing admin secret", http.StatusUnauthorized)

		return
	}

	id := r.PathValue("id")

	if fs.failIDs[id] {
		http.Error(w, "boom", http.StatusInternalServerError)

		return
	}

	if err := r.ParseMultipartForm(1 << 20); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)

		return
	}

	f, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)

		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	fs.mu.Lock()
	fs.uploaded[id] = data
	fs.mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

func (fs *fakeStorage) uploadedSnapshot() map[string][]byte {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	out := make(map[string][]byte, len(fs.uploaded))
	maps.Copy(out, fs.uploaded)

	return out
}

func seedLocalFiles(t *testing.T, nhostFolder, bucketID string, files map[string][]byte) {
	t.Helper()

	bucketDir := filepath.Join(nhostFolder, "files", bucketID)
	if err := os.MkdirAll(bucketDir, testDirPerm); err != nil {
		t.Fatalf("mkdir %s: %v", bucketDir, err)
	}

	for id, data := range files {
		dest := filepath.Join(bucketDir, id)
		if err := os.WriteFile(dest, data, testFilePerm); err != nil {
			t.Fatalf("write %s: %v", dest, err)
		}
	}
}

func TestApplyAllBuckets_HappyPath(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	fs.bucketFiles = map[string][]fileSummary{
		"bucket-a": {
			{ID: "a1", Name: "alpha.txt"},
			{ID: "a2", Name: "beta.txt"},
		},
		"bucket-b": {
			{ID: "b1", Name: "gamma.txt"},
		},
	}

	nhostFolder := t.TempDir()
	seedLocalFiles(t, nhostFolder, "bucket-a", map[string][]byte{
		"a1": []byte("AAA"),
		"a2": []byte("BBB"),
	})
	seedLocalFiles(t, nhostFolder, "bucket-b", map[string][]byte{
		"b1": []byte("GGG"),
	})

	ce := newTestCliEnv(nhostFolder, "")

	if err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	); err != nil {
		t.Fatalf("ApplyAllBuckets failed: %v", err)
	}

	want := map[string][]byte{
		"a1": []byte("AAA"),
		"a2": []byte("BBB"),
		"b1": []byte("GGG"),
	}
	got := fs.uploadedSnapshot()

	if diff := cmp.Diff(want, got); diff != "" {
		t.Fatalf("uploaded mismatch (-want +got):\n%s", diff)
	}
}

func TestApplyAllBuckets_MissingLocalFileWarnedAndSkipped(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	fs.bucketFiles = map[string][]fileSummary{
		"bucket-a": {
			{ID: "present", Name: "p.txt"},
			{ID: "missing", Name: "m.txt"},
		},
	}

	nhostFolder := t.TempDir()
	seedLocalFiles(t, nhostFolder, "bucket-a", map[string][]byte{
		"present": []byte("here"),
	})

	ce := newTestCliEnv(nhostFolder, "")

	if err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	); err != nil {
		t.Fatalf("expected nil error for missing-local case, got: %v", err)
	}

	got := fs.uploadedSnapshot()
	if _, ok := got["missing"]; ok {
		t.Fatalf("missing file should not have been uploaded; got %v", got)
	}

	if string(got["present"]) != "here" {
		t.Fatalf("present file content mismatch: %q", got["present"])
	}
}

func TestApplyAllBuckets_ErrorAggregation(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	fs.bucketFiles = map[string][]fileSummary{
		"bucket-a": {
			{ID: "ok", Name: "ok.txt"},
			{ID: "fail-1", Name: "f1.txt"},
			{ID: "fail-2", Name: "f2.txt"},
		},
	}
	fs.failIDs = map[string]bool{
		"fail-1": true,
		"fail-2": true,
	}

	nhostFolder := t.TempDir()
	seedLocalFiles(t, nhostFolder, "bucket-a", map[string][]byte{
		"ok":     []byte("fine"),
		"fail-1": []byte("x"),
		"fail-2": []byte("y"),
	})

	ce := newTestCliEnv(nhostFolder, "")

	err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	)
	if err == nil {
		t.Fatalf("expected aggregated error, got nil")
	}

	if !errors.Is(err, errStorageReplace) {
		t.Fatalf("expected error to wrap errStorageReplace, got: %v", err)
	}

	msg := err.Error()
	for _, id := range []string{"fail-1", "fail-2"} {
		if !strings.Contains(msg, id) {
			t.Errorf("expected aggregated error to mention %q, got: %s", id, msg)
		}
	}

	if string(fs.uploadedSnapshot()["ok"]) != "fine" {
		t.Errorf("the ok file should still have been uploaded")
	}
}

func TestApplyAllBuckets_ConcurrencyBound(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	fs.putDelay = 20 * time.Millisecond

	const totalFiles = 20

	files := make([]fileSummary, totalFiles)
	local := make(map[string][]byte, totalFiles)

	for i := range totalFiles {
		id := "f" + strings.Repeat("x", i+1)
		files[i] = fileSummary{ID: id, Name: id + ".bin"}
		local[id] = []byte(id)
	}

	fs.bucketFiles = map[string][]fileSummary{"bucket-a": files}

	nhostFolder := t.TempDir()
	seedLocalFiles(t, nhostFolder, "bucket-a", local)

	ce := newTestCliEnv(nhostFolder, "")

	if err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	); err != nil {
		t.Fatalf("ApplyAllBuckets failed: %v", err)
	}

	if got := fs.maxInFlight.Load(); got > int32(uploadConcurrency) {
		t.Fatalf(
			"max in-flight uploads = %d, exceeded uploadConcurrency = %d",
			got, uploadConcurrency,
		)
	}

	if got := len(fs.uploadedSnapshot()); got != totalFiles {
		t.Fatalf("expected %d uploads, got %d", totalFiles, got)
	}
}

func TestApplyAllBuckets_NoFilesDir(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	nhostFolder := t.TempDir()

	ce := newTestCliEnv(nhostFolder, "")

	if err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	); err != nil {
		t.Fatalf("expected nil for missing files dir, got: %v", err)
	}

	if got := len(fs.uploadedSnapshot()); got != 0 {
		t.Fatalf("expected zero uploads, got %d", got)
	}
}

func TestApplyAllBuckets_EmptyBucketFilesDir(t *testing.T) {
	t.Parallel()

	fs := newFakeStorage(t)
	nhostFolder := t.TempDir()

	if err := os.MkdirAll(filepath.Join(nhostFolder, "files"), testDirPerm); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	ce := newTestCliEnv(nhostFolder, "")

	if err := ApplyAllBuckets(
		t.Context(), ce, fs.storageURL(), fs.graphqlURL(), "secret",
	); err != nil {
		t.Fatalf("expected nil for empty files dir, got: %v", err)
	}

	if got := len(fs.uploadedSnapshot()); got != 0 {
		t.Fatalf("expected zero uploads, got %d", got)
	}
}
