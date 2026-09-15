package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/api"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/metadata/source"
	"gopkg.in/yaml.v3"
)

// Offline Hasura-parity replay harness.
//
// This harness replays Hasura-format metadata cases against the real
// /v1/metadata wire path (gin router + middleware + OpenAPI validation +
// dispatchMutation + classifyMutationError + finishMutation + the bulk
// dispatchers) using an in-memory Store with no data-database handle. It needs
// no live Hasura and no live Postgres, so it runs in plain `go test`.
//
// Why the controller package (not metadata/source): the HTTP-layer error→code
// mapping (classifyMutationError), the idempotency/200 vs 400 decision
// (finishMutation), and the bulk / bulk_atomic / bulk_keep_going dispatch all
// live here. Replaying through buildMutationRouter exercises exactly the bytes a
// real client would get, which is what "consistent with Hasura" must mean.
//
// Case files live under testdata/hasura/<family>/*.yaml. Each file is a fixture
// (a seed snapshot) plus an ordered list of steps; steps share Store state so
// create→drop and setup→measure sequences work. A case file encodes the
// EXPECTED CONSTELLATION response, which is Hasura's response except where we
// intentionally diverge — those steps carry a `divergence:` note pointing at
// KNOWN_DIFFERENCES.md. See testdata/hasura/PORTING_MAP.md for the full triage.
//
// Run: go test ./services/constellation/controller -run TestHasuraParityReplay

// buildReplayRouter is buildMutationRouter with the Store also wired as the
// Controller's metadata.Source, so export_metadata is served from the live
// snapshot (exportMetadata reads c.source, not c.store).
func buildReplayRouter(t *testing.T, store *source.Store) http.Handler {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true
	router.Use(middleware.Session(testAdminSecret, middleware.NewNoOpJWTAuthenticator()))

	ctrl := &Controller{
		adminSecret: testAdminSecret,
		hasuraProxy: nil,
		store:       store,
		source:      store,
		version:     "test",
	}

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatalf("loading embedded spec: %v", err)
	}

	handler := api.NewStrictHandler(ctrl, nil)
	api.RegisterHandlersWithOptions(router, handler, api.GinServerOptions{
		BaseURL: "",
		Middlewares: []api.MiddlewareFunc{
			api.MiddlewareFunc(NewCaptureRawBody(testMetadataBodyCap)),
			api.MiddlewareFunc(testOpenAPIValidator(t, spec)),
		},
		ErrorHandler: nil,
	})

	return router
}

// defaultReplaySeed is the empty single-source snapshot used when a case file
// does not supply its own `seed:`. It mirrors newBootstrappedStore's seed.
const defaultReplaySeed = `{"version":3,"sources":[{"name":"default","kind":"postgres",` +
	`"tables":[],"configuration":{"connection_info":{"database_url":` +
	`{"from_env":"PG"},"isolation_level":"read-committed",` +
	`"use_prepared_statements":true}}}]}`

// replayFile is one ported Hasura test file: a fixture plus ordered steps.
type replayFile struct {
	// Description documents the file and cites its Hasura source path.
	Description string `yaml:"description"`
	// Source is the upstream Hasura path the case was ported from.
	Source string `yaml:"source"`
	// Seed overrides the default empty snapshot. Inline Hasura-metadata JSON.
	Seed string `yaml:"seed"`
	// Steps run in order against one shared Store.
	Steps []replayStep `yaml:"steps"`
}

// replayStep is one /v1/metadata request and its expected response.
type replayStep struct {
	Description string `yaml:"description"`
	// Skip, when set, marks the step skipped with the given reason.
	Skip string `yaml:"skip"`
	// Divergence documents why the expected response differs from raw Hasura
	// (it is logged, not asserted). Should reference KNOWN_DIFFERENCES.md.
	Divergence string `yaml:"divergence"`
	Query      struct {
		Type string    `yaml:"type"`
		Args yaml.Node `yaml:"args"`
	} `yaml:"query"`
	// Status is the expected HTTP status. Only the class (2xx vs >=400) is
	// asserted unless ExactStatus is set.
	Status      int  `yaml:"status"`
	ExactStatus bool `yaml:"exactStatus"`
	// MatchError, when true, additionally asserts the exact error string (and
	// path) on an error response (not just the code).
	MatchError bool `yaml:"matchError"`
	// MatchPath, when true, asserts the error `path` independently of the error
	// string (useful for bulk fail-fast, where the path identifies the failing
	// child but the message wording is a documented divergence).
	MatchPath bool `yaml:"matchPath"`
	// Response is the expected body: a map (success/idempotent/error) or a
	// sequence (bulk success array).
	Response yaml.Node `yaml:"response"`
	// ExpectBody, when present, is deep-compared as a SUBSET of the success
	// response body (every key/element in ExpectBody must be present and equal in
	// the actual body; unspecified keys are ignored). Used for export_metadata
	// round-trips where the full body carries env-derived source config we don't
	// want to pin.
	ExpectBody yaml.Node `yaml:"expectBody"`
}

func TestHasuraParityReplay(t *testing.T) {
	t.Parallel()

	root := filepath.Join("testdata", "hasura")

	var files []string

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}
		// Skip docs and shared fixtures (leading underscore).
		base := d.Name()
		if !strings.HasSuffix(base, ".yaml") || strings.HasPrefix(base, "_") {
			return nil
		}

		files = append(files, path)

		return nil
	})
	if err != nil {
		t.Fatalf("walking %s: %v", root, err)
	}

	if len(files) == 0 {
		t.Fatalf("no parity case files found under %s", root)
	}

	for _, path := range files {
		name := strings.TrimSuffix(
			strings.TrimPrefix(filepath.ToSlash(path), filepath.ToSlash(root)+"/"),
			".yaml",
		)

		t.Run(name, func(t *testing.T) {
			t.Parallel()
			runReplayFile(t, path)
		})
	}
}

func runReplayFile(t *testing.T, path string) {
	t.Helper()

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}

	var file replayFile
	if err := yaml.Unmarshal(raw, &file); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}

	if len(file.Steps) == 0 {
		t.Fatalf("%s: no steps", path)
	}

	seed := file.Seed
	if strings.TrimSpace(seed) == "" {
		seed = defaultReplaySeed
	}

	store := source.NewStore(&writerStub{}, nil, nil)
	if err := store.BootstrapFromJSON([]byte(seed), 11); err != nil {
		t.Fatalf("%s: bootstrap seed: %v", path, err)
	}

	router := buildReplayRouter(t, store)

	for i, step := range file.Steps {
		stepName := step.Description
		if stepName == "" {
			stepName = fmt.Sprintf("step-%d", i)
		}

		t.Run(stepName, func(t *testing.T) {
			runReplayStep(t, router, step)
		})
	}
}

func runReplayStep(t *testing.T, router http.Handler, step replayStep) {
	t.Helper()

	if step.Skip != "" {
		t.Skipf("skipped: %s", step.Skip)
	}

	if step.Divergence != "" {
		t.Logf("divergence from Hasura: %s", step.Divergence)
	}

	body, err := replayRequestBody(step)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	wantErr := step.Status >= http.StatusBadRequest

	// Bulk success returns a bare top-level array; everything else returns an
	// object. Detect the bulk-array expectation from the response shape.
	if !wantErr && step.Response.Kind == yaml.SequenceNode {
		assertBulkArray(t, router, body, step)

		return
	}

	code, resp := postJSON(t, router, body)

	assertStatus(t, step, code)

	if wantErr {
		assertErrorBody(t, step, resp)

		return
	}

	assertSuccessBody(t, step, resp)
}

// replayRequestBody renders a step's {type, args} into a JSON request body,
// preserving the args verbatim from YAML.
func replayRequestBody(step replayStep) (string, error) {
	var args any
	if step.Query.Args.Kind != 0 {
		if err := step.Query.Args.Decode(&args); err != nil {
			return "", fmt.Errorf("decoding args: %w", err)
		}
	}

	envelope := map[string]any{"type": step.Query.Type}
	if args != nil {
		envelope["args"] = args
	} else {
		envelope["args"] = map[string]any{}
	}

	out, err := json.Marshal(envelope)
	if err != nil {
		return "", fmt.Errorf("marshaling request: %w", err)
	}

	return string(out), nil
}

func assertStatus(t *testing.T, step replayStep, got int) {
	t.Helper()

	if step.ExactStatus {
		if got != step.Status {
			t.Errorf("status = %d, want exactly %d", got, step.Status)
		}

		return
	}

	wantClass := statusClass(step.Status)
	if gotClass := statusClass(got); gotClass != wantClass {
		t.Errorf("status class = %s (%d), want %s (%d)", gotClass, got, wantClass, step.Status)
	}
}

func statusClass(code int) string {
	if code >= http.StatusBadRequest {
		return "error"
	}

	return "ok"
}

func assertErrorBody(t *testing.T, step replayStep, resp map[string]any) {
	t.Helper()

	var want struct {
		Code  string `yaml:"code"`
		Error string `yaml:"error"`
		Path  string `yaml:"path"`
	}

	if err := step.Response.Decode(&want); err != nil {
		t.Fatalf("decoding expected error response: %v", err)
	}

	if got, _ := resp["code"].(string); got != want.Code {
		t.Errorf("error code = %q, want %q (body=%v)", got, want.Code, resp)
	}

	if (step.MatchError || step.MatchPath) && want.Path != "" {
		if got, _ := resp["path"].(string); got != want.Path {
			t.Errorf("error path = %q, want %q", got, want.Path)
		}
	}

	if !step.MatchError {
		return
	}

	if got, _ := resp["error"].(string); got != want.Error {
		t.Errorf("error message = %q, want %q", got, want.Error)
	}
}

func assertSuccessBody(t *testing.T, step replayStep, resp map[string]any) {
	t.Helper()

	// A `response:` block pins the message; absent, the message is not checked.
	if step.Response.Kind != 0 {
		var want struct {
			Message string `yaml:"message"`
		}

		if err := step.Response.Decode(&want); err != nil {
			t.Fatalf("decoding expected success response: %v", err)
		}

		if want.Message != "" {
			if got, _ := resp["message"].(string); got != want.Message {
				t.Errorf("message = %q, want %q (body=%v)", got, want.Message, resp)
			}
		}
	}

	// An `expectBody:` block subset-matches the full success body (independent of
	// whether a `response:` message was also pinned).
	if step.ExpectBody.Kind != 0 {
		var wantBody any
		if err := step.ExpectBody.Decode(&wantBody); err != nil {
			t.Fatalf("decoding expectBody: %v", err)
		}

		assertSubset(t, "$", normalizeJSON(t, wantBody), normalizeJSON(t, resp))
	}
}

// normalizeJSON round-trips a value through JSON so YAML ints and JSON float64s
// compare equal and key types are uniform.
func normalizeJSON(t *testing.T, v any) any {
	t.Helper()

	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("normalizeJSON marshal: %v", err)
	}

	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("normalizeJSON unmarshal: %v", err)
	}

	return out
}

// assertSubset asserts that want is a structural subset of got: every map key in
// want must exist and match in got; every slice element in want must match got
// at the same index (got may be longer); scalars must be equal.
func assertSubset(t *testing.T, path string, want, got any) {
	t.Helper()

	switch w := want.(type) {
	case map[string]any:
		g, ok := got.(map[string]any)
		if !ok {
			t.Errorf("%s: expected object, got %T (%v)", path, got, got)

			return
		}

		for k, wv := range w {
			gv, ok := g[k]
			if !ok {
				t.Errorf("%s.%s: missing key in actual body", path, k)

				continue
			}

			assertSubset(t, path+"."+k, wv, gv)
		}
	case []any:
		g, ok := got.([]any)
		if !ok {
			t.Errorf("%s: expected array, got %T (%v)", path, got, got)

			return
		}

		if len(g) < len(w) {
			t.Errorf("%s: array len = %d, want at least %d", path, len(g), len(w))

			return
		}

		for i := range w {
			assertSubset(t, fmt.Sprintf("%s[%d]", path, i), w[i], g[i])
		}
	default:
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("%s: (-want +got)\n%s", path, diff)
		}
	}
}

// assertBulkArray handles the bulk / bulk_keep_going success shape: a bare
// top-level array whose elements are per-child result objects.
func assertBulkArray(t *testing.T, router http.Handler, body string, step replayStep) {
	t.Helper()

	code, arr, raw := postJSONArray(t, router, body)

	assertStatus(t, step, code)

	var want []map[string]any
	if err := step.Response.Decode(&want); err != nil {
		t.Fatalf("decoding expected bulk response: %v", err)
	}

	if len(arr) != len(want) {
		t.Fatalf("bulk result length = %d, want %d (raw=%s)", len(arr), len(want), raw)
	}

	for i := range want {
		elem, _ := arr[i].(map[string]any)

		// A per-child success element pins "message"; a per-child failure element
		// (bulk_keep_going) pins "code".
		if wantMsg, ok := want[i]["message"].(string); ok {
			if got, _ := elem["message"].(string); got != wantMsg {
				t.Errorf("bulk[%d] message = %q, want %q", i, got, wantMsg)
			}
		}

		if wantCode, ok := want[i]["code"].(string); ok {
			if got, _ := elem["code"].(string); got != wantCode {
				t.Errorf("bulk[%d] code = %q, want %q", i, got, wantCode)
			}
		}
	}
}
