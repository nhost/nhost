package integration_test

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

// This file implements the Hasura <-> Constellation metadata-authoring parity
// harness. For each dashboard-parity op it applies the SAME /v1/metadata
// request to both engines and compares the results in three layers:
//
//	Layer A — response parity: HTTP status class and (on error) the Hasura code.
//	Layer B — exported metadata: export_metadata from both, normalized, deep-diff.
//	Layer C — schema delta: for surface-changing ops, the per-engine SDL delta
//	          vs baseline (so pre-existing baseline divergences don't fail us).
//
// Isolation: the two engines own separate hdb_catalog.hdb_metadata stores
// (Constellation's lives in the `cstl` DB created by parity-env-up) but
// introspect the same `local` data DB, so their schemas match. Before every
// case both engines are reset to Hasura's live baseline via replace_metadata,
// making cases order-independent.
//
// Run with:
//
//	make dev-env-integration-up && make build-docker-image && make parity-env-up
//	cd integration && go test -run TestMetadataParity -v ./...
//	make parity-env-down

//nolint:gochecknoglobals
var (
	// hasuraMetadataURL / constellationMetadataURL are the /v1/metadata
	// endpoints. Constellation here is the parity instance started by
	// `make parity-env-up` on :8001 (owns the isolated `cstl` metadata DB).
	hasuraMetadataURL = getEnvOrDefault(
		"HASURA_METADATA_URL",
		"https://local.hasura.local.nhost.run/v1/metadata",
	)
	constellationMetadataURL = getEnvOrDefault(
		"CONSTELLATION_METADATA_URL",
		"http://localhost:8001/v1/metadata",
	)
	// constellationGraphQLURL is the parity instance's GraphQL endpoint, used
	// by Layer C to dump its SDL.
	constellationParityGraphQLURL = getEnvOrDefault(
		"CONSTELLATION_PARITY_GRAPHQL_URL",
		"http://localhost:8001/v1/graphql",
	)
)

// metadataParityCase is one op applied to both engines.
type metadataParityCase struct {
	name string
	// setup is ops applied to BOTH engines (asserting success) before the
	// measured op, so create->drop / create->rename pairs can be tested even
	// though only one op per case is compared. Not compared themselves.
	setup []string
	// op is the full /v1/metadata request body (type + args).
	op string
	// wantErr is true when the op is expected to fail on both engines; the
	// harness then compares the Hasura error `code` instead of the export.
	wantErr bool
	// affectsSchema gates Layer C: set when the op changes the GraphQL surface
	// (tracking, permissions, relationships, functions) as opposed to
	// metadata-only state (event-trigger config, comments).
	affectsSchema bool
	// allowStatusDivergence skips the Layer A status-class check for ops where
	// Constellation intentionally diverges from Hasura — notably idempotent
	// re-apply, where Constellation returns 200 with an idempotency code
	// (already-tracked / already-exists) while Hasura returns 400. The
	// resulting metadata (Layer B) must still match.
	allowStatusDivergence bool
	// knownDivergence, when non-empty, marks this case as an ACCEPTED, justified
	// divergence (per drop-in parity: a divergence is an error unless justified).
	// Its mismatches are logged with this reason instead of failing the suite,
	// and a Hasura error no longer aborts the case. Keep the reason specific and
	// keep this list short — it is the explicit allowlist, documented in
	// docs/user/hasura-metadata-support.md.
	knownDivergence string
	// query, when non-empty, is a GraphQL query run against BOTH engines'
	// GraphQL endpoints after the op (Layer D). It proves the op produced not
	// just matching metadata/SDL but matching runtime behaviour — the one axis
	// the export/SDL layers cannot see (e.g. that a relationship field actually
	// resolves and stitches). Opt-in: set only where a meaningful, deterministic
	// query exists. Queries over lists must be deterministically ordered.
	query string
	// queryRole is the x-hasura-role for the Layer D query; defaults to "admin".
	queryRole string
	// queryWantErr inverts the Layer D assertion: instead of requiring a matching
	// error-free result, it requires BOTH engines to reject the query with a
	// GraphQL error. Used after a drop op to prove the relationship field stops
	// resolving on both engines (the field is gone, not merely absent from the
	// export). Error bodies are not deep-compared — engines word them differently.
	queryWantErr bool
	// wantConstellationOK hard-asserts that Constellation accepts the op with a
	// 2xx status, even when knownDivergence is set. Without it, a knownDivergence
	// case logs every mismatch and so asserts nothing about Constellation's own
	// result; set it for accepted export-divergence cases where the op itself
	// must still succeed natively.
	wantConstellationOK bool
}

// metadataRequestTimeout bounds each /v1/metadata call. A reset (replace_metadata)
// can trigger a full schema rebuild on Hasura, so it is generous — but finite, so
// one stuck request fails the case instead of hanging the whole suite (and CI).
const metadataRequestTimeout = 90 * time.Second

// postMetadata POSTs body to a /v1/metadata endpoint with the admin secret and
// returns the status code and raw response body.
func postMetadata(t *testing.T, url, body string) (int, []byte) {
	t.Helper()

	// context.Background (not t.Context): postMetadata is also called from
	// t.Cleanup, by which point t.Context() is already canceled. The timeout
	// still bounds each request.
	ctx, cancel := context.WithTimeout(context.Background(), metadataRequestTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, url, bytes.NewReader([]byte(body)),
	)
	if err != nil {
		t.Fatalf("building metadata request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("posting to %s: %v", url, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("reading response from %s: %v", url, err)
	}

	return resp.StatusCode, raw
}

// exportMetadataObject posts export_metadata to url and returns the bare
// metadata object. The two engines disagree on the envelope shape: Hasura v2's
// default export_metadata returns the bare object ({version, sources, …}), while
// Constellation (and Hasura's version-2 export) wraps it as
// {resource_version, metadata}. We accept both by keying on the "metadata" field.
func exportMetadataObject(t *testing.T, url string) jsontext.Value {
	t.Helper()

	status, body := postMetadata(t, url, `{"type":"export_metadata","args":{}}`)
	if status != http.StatusOK {
		t.Fatalf("export_metadata from %s: status=%d body=%s", url, status, body)
	}

	var env map[string]jsontext.Value
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("decoding export response from %s: %v", url, err)
	}

	if md, ok := env["metadata"]; ok {
		return md
	}

	if len(body) == 0 {
		t.Fatalf("export from %s returned empty body", url)
	}

	return jsontext.Value(body)
}

// fetchBaselineMetadata returns Hasura's current metadata object, used to reset
// both engines before each case.
func fetchBaselineMetadata(t *testing.T) jsontext.Value {
	t.Helper()

	return exportMetadataObject(t, hasuraMetadataURL)
}

// withoutRemoteSchemas returns the metadata object with its top-level
// "remote_schemas" removed, so resetting to it does not make Hasura re-validate
// (re-introspect) remote schemas on every subsequent pg_* op.
func withoutRemoteSchemas(t *testing.T, meta jsontext.Value) jsontext.Value {
	t.Helper()

	var m map[string]jsontext.Value
	if err := json.Unmarshal(meta, &m); err != nil {
		t.Fatalf("decoding baseline for remote-schema strip: %v", err)
	}

	delete(m, "remote_schemas")

	out, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("re-encoding baseline: %v", err)
	}

	return out
}

// resetMetadata replaces an engine's metadata with the baseline so each case
// starts from an identical, consistent state.
func resetMetadata(t *testing.T, url string, baseline jsontext.Value) {
	t.Helper()

	body := fmt.Sprintf(
		`{"type":"replace_metadata","args":{"allow_inconsistent_metadata":true,"metadata":%s}}`,
		baseline,
	)

	status, resp := postMetadata(t, url, body)
	if status/100 != 2 {
		t.Fatalf("replace_metadata reset on %s: status=%d body=%s", url, status, resp)
	}
}

// parityEnvReady reports whether the parity Constellation (:8001) is reachable,
// so the suite can skip cleanly when `make parity-env-up` has not been run
// rather than failing with a raw connection error.
//
// It distinguishes "not deployed" from "deployed but broken": a skip is only
// warranted when the server is absent (a dial/connection error from Do). ANY HTTP
// response — including a 5xx from a regressed export_metadata handler — counts as
// ready, so the suite runs and the first real export_metadata call fails loudly
// instead of a metadata regression being masked as a green skip.
func parityEnvReady() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, constellationMetadataURL,
		bytes.NewReader([]byte(`{"type":"export_metadata","args":{}}`)),
	)
	if err != nil {
		return false
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hasura-Admin-Secret", adminSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		// Connection/dial error: the parity instance is not deployed. Skip.
		return false
	}

	defer resp.Body.Close()

	// Any reachable HTTP response (even a 5xx) means the server is up; let the
	// suite run so a broken metadata handler surfaces as a failure, not a skip.
	return true
}

// errorCode extracts the top-level Hasura error `code` from a 4xx body. The
// unmarshal error is returned (not discarded) so callers can distinguish an
// unparseable body from one that simply lacks a `code` field.
func errorCode(body []byte) (string, error) {
	var e struct {
		Code string `json:"code"`
	}

	if err := json.Unmarshal(body, &e); err != nil {
		return "", fmt.Errorf("decoding error body: %w", err)
	}

	return e.Code, nil
}

// runMetadataParityTests applies each case to both engines and asserts the
// layered equivalence described at the top of this file.
func runMetadataParityTests(t *testing.T, cases []metadataParityCase) {
	t.Helper()

	if !parityEnvReady() {
		t.Skipf(
			"parity Constellation not reachable at %s; run `make parity-env-up` "+
				"(after dev-env-integration-up + build-docker-image)",
			constellationMetadataURL,
		)
	}

	// Remove any leftover parity entities from a previously interrupted run
	// (best-effort, idempotent) so the captured baseline is clean. Without this,
	// a killed run can leave e.g. a `paritytest` permission in the shared Hasura,
	// poisoning the baseline and turning create cases into spurious already-exists.
	cleanupParityEntities(t)

	original := fetchBaselineMetadata(t)

	// Working baseline = Hasura's metadata with remote_schemas removed. Applying
	// any pg_* op makes Hasura re-validate its remote schemas (an HTTP
	// introspection), which hangs the whole suite if that endpoint is slow or
	// down. The parity cases only touch pg_* metadata, so dropping remote schemas
	// from the reset baseline keeps the suite fast and independent of
	// remote-schema endpoint health. The original (with remote schemas) is
	// restored in cleanup.
	baseline := withoutRemoteSchemas(t, original)

	// The parity cases mutate the SHARED Hasura metadata (and Constellation's),
	// which the other integration tests depend on. Restore both to the ORIGINAL
	// captured baseline when the suite finishes so it leaves no trace.
	t.Cleanup(func() {
		resetMetadata(t, hasuraMetadataURL, original)
		resetMetadata(t, constellationMetadataURL, original)
	})

	// Reset both engines to the same baseline and capture the divergence between
	// their exports. Because the input is identical, anything that differs here
	// is a Constellation round-trip-fidelity divergence (it re-serializes the
	// metadata differently than Hasura). Constellation aims to be a drop-in
	// Hasura replacement, so these are errors unless justified — but they are a
	// property of the snapshot, independent of any op, so we (a) report them once
	// below and (b) subtract them from each op's delta so per-op cases measure
	// op-effect parity rather than re-flagging the same baseline noise.
	resetMetadata(t, hasuraMetadataURL, baseline)
	resetMetadata(t, constellationMetadataURL, baseline)

	baselineDivergence := diffExports(t)

	t.Run("roundtrip_baseline_fidelity", func(t *testing.T) {
		unjustified := dropJustified(baselineDivergence)
		if len(unjustified) > 0 {
			t.Errorf(
				"Constellation does not round-trip Hasura metadata faithfully: "+
					"%d divergent leaves (-only in hasura +only in constellation):\n%s",
				len(unjustified), formatDivergence(unjustified),
			)
		}
	})

	for _, tc := range cases {
		// Metadata is global per engine, so cases run serially (no t.Parallel).
		t.Run(tc.name, func(t *testing.T) {
			runMetadataParityCase(t, baseline, baselineDivergence, tc)
		})
	}
}

// cleanupParityEntities issues best-effort, idempotent resets of every entity the
// parity cases mutate (role "paritytest" permissions, parity_* / renamed
// relationships, the parity event trigger, and the departments/get_department_manager
// customizations), on both engines. Errors are ignored: the goal is only to ensure
// a previously interrupted run did not leave these behind to poison the freshly
// captured baseline. The customization resets matter especially because they mutate
// SHARED, pre-existing objects in place (rather than additive entities a drop would
// remove): an interrupted run after a customization case would otherwise bake a
// stray custom_name into the captured baseline and leak it to every other test.
func cleanupParityEntities(t *testing.T) {
	t.Helper()

	const (
		role  = "paritytest"
		dept  = `{"schema":"public","name":"departments"}`
		udept = `{"schema":"public","name":"user_departments"}`
		fn    = `{"schema":"public","name":"get_department_manager"}`
	)

	ops := []string{
		`{"type":"pg_drop_select_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_update_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_select_permission","args":{"source":"default","table":` + udept + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_function_permission","args":{"source":"default","function":` + fn + `,"role":"` + role + `"}}`,
		`{"type":"pg_drop_relationship","args":{"source":"default","table":` + udept + `,"relationship":"parity_dept"}}`,
		`{"type":"pg_drop_relationship","args":{"source":"default","table":` + udept + `,"relationship":"parity_dept_renamed"}}`,
		`{"type":"pg_drop_relationship","args":{"source":"default","table":` + dept + `,"relationship":"parity_members"}}`,
		`{"type":"pg_delete_event_trigger","args":{"source":"default","table":` + dept + `,"name":"parity_etrigger"}}`,
		// Reset the two in-place customizations the suite applies (custom_name
		// ParityDepartments on departments; parityMgr on get_department_manager) by
		// re-applying an empty configuration, the inverse of the customization op.
		`{"type":"pg_set_table_customization","args":{"source":"default","table":` + dept + `,"configuration":{}}}`,
		`{"type":"pg_set_function_customization","args":{"source":"default","function":` + fn + `,"configuration":{}}}`,
		// Remote-schema entities the parity cases add (remove cascades permissions).
		`{"type":"remove_remote_schema","args":{"name":"parity_rs"}}`,
		`{"type":"remove_remote_schema","args":{"name":"parity_rs_unreachable"}}`,
	}

	for _, url := range []string{hasuraMetadataURL, constellationMetadataURL} {
		for _, op := range ops {
			_, _ = postMetadata(t, url, op)
		}
	}
}

// applyOpToBoth posts op to both engines, asserting success on each. Used for
// the per-case reset's setup steps.
func applyOpToBoth(t *testing.T, what, op string) {
	t.Helper()

	if status, body := postMetadata(t, hasuraMetadataURL, op); status/100 != 2 {
		t.Fatalf("%s failed on Hasura: %d %s", what, status, body)
	}

	if status, body := postMetadata(t, constellationMetadataURL, op); status/100 != 2 {
		t.Fatalf("%s failed on Constellation: %d %s", what, status, body)
	}
}

// runMetadataParityCase resets both engines to baseline, replays setup, applies
// the measured op to both, and runs the three comparison layers.
func runMetadataParityCase(
	t *testing.T, baseline jsontext.Value, baselineDivergence map[string]struct{},
	tc metadataParityCase,
) {
	t.Helper()

	// report records a divergence: a hard failure normally, or a logged note when
	// the case is an accepted (justified) divergence.
	report := t.Errorf
	if tc.knownDivergence != "" {
		report = func(format string, args ...any) {
			t.Logf("known divergence ["+tc.knownDivergence+"]: "+format, args...)
		}
	}

	resetMetadata(t, hasuraMetadataURL, baseline)
	resetMetadata(t, constellationMetadataURL, baseline)

	for _, s := range tc.setup {
		applyOpToBoth(t, "setup", s)
	}

	hStatus, hBody := postMetadata(t, hasuraMetadataURL, tc.op)
	cStatus, cBody := postMetadata(t, constellationMetadataURL, tc.op)

	// Hard-assert Constellation's own result up front (regardless of
	// knownDivergence), so an accepted export divergence cannot silently mask
	// the op failing natively on Constellation.
	if tc.wantConstellationOK && cStatus/100 != 2 {
		t.Errorf(
			"constellation rejected op that must succeed: status=%d body=%s",
			cStatus, cBody,
		)
	}

	// Layer A — response parity. Skipped for ops where Constellation
	// intentionally diverges (idempotent re-apply: 200 vs Hasura's 4xx).
	if !tc.allowStatusDivergence && hStatus/100 != cStatus/100 {
		report(
			"status class differs: hasura=%d (%s) constellation=%d (%s)",
			hStatus, hBody, cStatus, cBody,
		)
	}

	if tc.wantErr {
		assertErrorParity(report, hStatus, hBody, cBody)

		return
	}

	if hStatus/100 != 2 {
		// An accepted knownDivergence stops here: Hasura rejected an op it does
		// not support, so there is no shared post-op state to compare against.
		if tc.knownDivergence != "" {
			return
		}

		// An idempotent re-apply (allowStatusDivergence) is the one case where a
		// Hasura 4xx is still expected to leave the SAME metadata that
		// Constellation's idempotent 2xx does. Fall through to Layer B and
		// actually verify that equivalence — the whole point of the case, and
		// what allowStatusDivergence's contract promises. Any other Hasura error
		// is a real failure.
		if !tc.allowStatusDivergence {
			t.Fatalf("op failed on Hasura: status=%d body=%s", hStatus, hBody)
		}
	}

	// Layer B — exported metadata. Compare the two engines' exports as
	// content-addressed leaf sets, then subtract the baseline round-trip
	// divergence (reported separately) and the justified allowlist. What's left
	// is the divergence THIS op introduced — an error per drop-in parity.
	opDivergence := dropJustified(subtractDivergence(diffExports(t), baselineDivergence))
	if len(opDivergence) > 0 {
		report(
			"op introduces metadata divergence beyond baseline "+
				"(-only in hasura +only in constellation):\n%s",
			formatDivergence(opDivergence),
		)
	}

	// Layer C — schema delta for surface-changing ops. Opt-in (PARITY_SCHEMA_CHECK=1):
	// it dumps full SDL via the CLI several times per case, which is far slower
	// than the metadata comparison above, so it is off by default.
	if tc.affectsSchema && os.Getenv("PARITY_SCHEMA_CHECK") == "1" {
		compareSchemaDelta(t, baseline, tc)
	}

	// Layer D — query execution. For cases with a query, run it against both
	// engines' GraphQL endpoints and diff the responses, proving the op produced
	// matching runtime behaviour and not just matching metadata/SDL. The op is
	// already applied (above), leaving both engines in the post-op state.
	if tc.query != "" {
		compareQueryResult(t, report, tc)
	}
}

// compareQueryResult runs tc.query against both engines and diffs the decoded
// responses, reusing the query-diff primitive (makeHTTPQuery + cmp.Diff) from
// the RunGraphQLTests harness. Constellation's connector rebuild after a
// mutation is asynchronous, so its side is polled until it resolves cleanly.
func compareQueryResult(t *testing.T, report func(string, ...any), tc metadataParityCase) {
	t.Helper()

	role := tc.queryRole
	if role == "" {
		role = "admin"
	}

	headers := http.Header{
		"x-hasura-admin-secret": []string{adminSecret},
		"x-hasura-role":         []string{role},
	}
	q := query{Query: tc.query, Role: role}

	hasuraResp, err := makeHTTPQuery(t.Context(), hasuraURL, q, headers)
	if err != nil {
		t.Fatalf("hasura query failed: %v", err)
	}

	// Hasura is the oracle: its response must match the case's expectation, or
	// the fixture (query vs op) is wrong.
	if hasErrors(hasuraResp) != tc.queryWantErr {
		t.Fatalf(
			"hasura precondition failed for parity query %q: wantErr=%v, response=%v",
			tc.name, tc.queryWantErr, hasuraResp,
		)
	}

	// queryWantErr cases assert only that both engines reject the (removed) field;
	// error bodies diverge in wording, so they are not deep-compared.
	if tc.queryWantErr {
		if _, ok := pollGraphQL(t, q, headers, hasErrors); !ok {
			report(
				"constellation still resolves %q after drop while hasura rejects it",
				tc.name,
			)
		}

		return
	}

	// Success case: poll until Constellation's response converges to Hasura's.
	// Matching the oracle (not merely "error-free") is the correct readiness
	// signal for the asynchronous post-mutation rebuild: an object→array reshape,
	// for instance, leaves the pre-rebuild response error-free but the wrong shape.
	matches := func(resp any) bool { return cmp.Diff(hasuraResp, resp) == "" }

	constellationResp, ok := pollGraphQL(t, q, headers, matches)
	if !ok {
		report(
			"query result differs (-hasura +constellation):\n%s",
			cmp.Diff(hasuraResp, constellationResp),
		)
	}
}

// pollGraphQL issues the query against the Constellation parity endpoint until
// ready(response) holds or the 30s deadline elapses, returning the last
// error-free response and whether ready was satisfied. It accommodates
// Constellation's asynchronous post-mutation connector rebuild, during which a
// just-added field may not yet resolve, a reshaped field may still have its old
// shape, or a just-dropped field may still resolve.
func pollGraphQL(
	t *testing.T, q query, headers http.Header, ready func(any) bool,
) (any, bool) {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)

	var last any

	for time.Now().Before(deadline) {
		resp, err := makeHTTPQuery(t.Context(), constellationParityGraphQLURL, q, headers)
		if err == nil {
			last = resp
			if ready(resp) {
				return resp, true
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	return last, false
}

// hasErrors reports whether a decoded GraphQL response carries a non-empty
// top-level "errors" array.
func hasErrors(resp any) bool {
	m, ok := resp.(map[string]any)
	if !ok {
		return false
	}

	errs, ok := m["errors"].([]any)

	return ok && len(errs) > 0
}

// assertErrorParity checks both engines rejected the op with the same Hasura
// code, reporting via report (hard failure or logged known divergence).
func assertErrorParity(report func(string, ...any), hStatus int, hBody, cBody []byte) {
	if hStatus/100 == 2 {
		report("expected Hasura to reject the op, got %d: %s", hStatus, hBody)
	}

	hCode, hErr := errorCode(hBody)
	if hErr != nil {
		report("could not parse Hasura error body: %v: %s", hErr, hBody)
	}

	// A code-less Hasura body yields "", and a code-less Constellation body yields
	// "" too, so a bare equality check would pass while asserting nothing about the
	// rejection reason. Require a non-empty Hasura code so two empty codes can never
	// satisfy the equality below.
	if hCode == "" {
		report("could not extract Hasura error code from body: %s", hBody)
	}

	cCode, cErr := errorCode(cBody)
	if cErr != nil {
		report("could not parse Constellation error body: %v: %s", cErr, cBody)
	}

	if hCode != cCode {
		report("error code differs: hasura=%q constellation=%q", hCode, cCode)
	}
}

// diffExports exports both engines' metadata, flattens each to a
// content-addressed leaf set, and returns the symmetric difference: leaves
// present in exactly one engine. Keys are tagged "-" (only in Hasura, i.e.
// missing from Constellation) or "+" (only in Constellation, i.e. extra).
//
// We deliberately do NOT normalize away representational differences here:
// Constellation is a drop-in Hasura replacement, so any divergence is an error
// unless explicitly justified (see justifiedDivergence). The only neutral step
// is content-addressing array elements, so element order — which Hasura does not
// guarantee for metadata collections — is not treated as a difference.
//
// Accepted limitation — cardinality blindness: leaves are collected into a set,
// so the comparison is multiplicity-insensitive. Two array elements that share the
// same flattened leaf (same identity key and same content), or a genuine duplicate
// present N times in one engine and once in the other, collapse to a single set
// entry. A divergence that is PURELY a difference in element count (identical
// content, different multiplicity) is therefore invisible to diffExports. Hasura
// metadata collections are deduped by identity, so this is an edge case; surfacing
// it would require an occurrence ordinal in the element key, which would make the
// identity-localized leaf matching order-sensitive and is not worth the regression
// risk here.
func diffExports(t *testing.T) map[string]struct{} {
	t.Helper()

	h := exportLeaves(t, hasuraMetadataURL)
	c := exportLeaves(t, constellationMetadataURL)

	out := make(map[string]struct{})

	for k := range h {
		if _, ok := c[k]; !ok {
			out["-"+k] = struct{}{}
		}
	}

	for k := range c {
		if _, ok := h[k]; !ok {
			out["+"+k] = struct{}{}
		}
	}

	return out
}

// exportLeaves fetches an engine's metadata object and flattens it to a leaf set.
func exportLeaves(t *testing.T, url string) map[string]struct{} {
	t.Helper()

	var meta any
	if err := json.Unmarshal(exportMetadataObject(t, url), &meta); err != nil {
		t.Fatalf("decoding metadata from %s: %v", url, err)
	}

	out := make(map[string]struct{})
	flattenLeaves("$", meta, out)

	return out
}

// flattenLeaves walks a decoded JSON value into a set of "path=value" leaf
// strings. Array elements are addressed by a stable IDENTITY (table name, role,
// relationship/source/function name, …) rather than by index or full content,
// so the two engines' elements are matched up by identity and a divergence
// localizes to the specific leaf that differs — instead of marking a whole
// element mismatched and cascading to every leaf beneath it.
func flattenLeaves(prefix string, v any, out map[string]struct{}) {
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			flattenLeaves(prefix+"."+k, val, out)
		}
	case []any:
		for _, e := range t {
			flattenLeaves(prefix+"[#"+arrayElementKey(e)+"]", e, out)
		}
	default:
		out[prefix+"="+canonKey(v)] = struct{}{}
	}
}

// arrayElementKey returns a stable identity for an array element so elements are
// matched across engines by identity rather than full content. Hasura metadata
// collections are keyed by one of a small set of identity fields; we use the
// first present (in priority order). Scalar elements and objects with no known
// identity fall back to their canonical content.
func arrayElementKey(e any) string {
	m, ok := e.(map[string]any)
	if !ok {
		return canonKey(e)
	}

	for _, f := range []string{"name", "role", "table", "function", "column"} {
		if v, present := m[f]; present {
			return f + "=" + canonKey(v)
		}
	}

	return canonKey(e)
}

// subtractDivergence returns the leaves in d that are not in baseline.
func subtractDivergence(d, baseline map[string]struct{}) map[string]struct{} {
	out := make(map[string]struct{})

	for k := range d {
		if _, ok := baseline[k]; !ok {
			out[k] = struct{}{}
		}
	}

	return out
}

// justifiedDivergence reports whether a divergent leaf is an explicitly accepted
// (documented) divergence rather than an error. Each entry must be justified in
// a comment; the set is intentionally empty until a divergence is triaged and
// agreed to be acceptable. See docs/user/hasura-metadata-support.md.
func justifiedDivergence(_ string) bool {
	// No justified divergences yet — every difference is treated as an error.
	return false
}

// dropJustified removes justified divergences and returns the rest.
func dropJustified(d map[string]struct{}) map[string]struct{} {
	out := make(map[string]struct{})

	for k := range d {
		if !justifiedDivergence(k) {
			out[k] = struct{}{}
		}
	}

	return out
}

// formatDivergence renders a divergence set as sorted lines for test output.
func formatDivergence(d map[string]struct{}) string {
	lines := make([]string, 0, len(d))
	for k := range d {
		lines = append(lines, k)
	}

	sort.Strings(lines)

	return strings.Join(lines, "\n")
}

// canonKey returns a stable string for sorting array elements. json/v2 needs
// json.Deterministic to emit map keys in sorted order.
func canonKey(v any) string {
	b, err := json.Marshal(v, json.Deterministic(true))
	if err != nil {
		return fmt.Sprintf("%v", v)
	}

	return string(b)
}

// ----- Layer C: schema delta -----

//nolint:gochecknoglobals
var (
	parityCLIOnce sync.Once
	parityCLIPath string
	errParityCLI  error
)

// buildParityCLI compiles the Nhost CLI once (the `schema dump`/`schema diff`
// subcommands), avoiding a `go run` recompile per dump.
func buildParityCLI(t *testing.T) string {
	t.Helper()

	parityCLIOnce.Do(func() {
		out := os.TempDir() + "/parity-cli"

		cmd := exec.CommandContext(t.Context(), "go", "build", "-o", out, "../../../cli")
		if combined, err := cmd.CombinedOutput(); err != nil {
			errParityCLI = fmt.Errorf("building cli: %w: %s", err, combined)

			return
		}

		parityCLIPath = out
	})

	if errParityCLI != nil {
		t.Fatalf("Layer C: %v", errParityCLI)
	}

	return parityCLIPath
}

// dumpSDL returns the admin-role SDL of the engine at graphqlURL.
func dumpSDL(t *testing.T, graphqlURL string) string {
	t.Helper()

	cli := buildParityCLI(t)
	out := t.TempDir() + "/schema.graphqls"

	cmd := exec.CommandContext(t.Context(), cli, "schema", "dump",
		"--role", "admin", "--admin-secret", adminSecret, "-u", graphqlURL, "-o", out)
	if combined, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("schema dump (%s): %v: %s", graphqlURL, err, combined)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("reading dumped SDL: %v", err)
	}

	return string(data)
}

// settledSDL dumps graphqlURL repeatedly until two consecutive dumps are
// byte-identical, or the 30s deadline elapses (returning the last dump). A 2xx
// from a store-backed Constellation metadata op does not imply the GraphQL
// surface has converged: Store.apply persists the write and returns
// immediately, while the connector rebuild runs on a separate goroutine
// (Controller.Run consumes source.Watch, then buildState+swapState — an atomic
// pointer swap, so a dump observes either the whole old surface or the whole new
// one, never a partial). A dump taken before the swap therefore sees the stale
// surface.
//
// This settles on self-stability, which is a WEAKER readiness signal than the
// oracle-convergence pollGraphQL applies in Layer D (that polls until the result
// matches Hasura, so it cannot settle early). A caller measuring the effect of a
// just-applied op must therefore use settledSDLAfterChange, which additionally
// waits for the surface to actually change before accepting stability — a plain
// settle could otherwise lock onto the stale pre-op SDL. The synchronous Hasura
// side needs no settling.
func settledSDL(t *testing.T, graphqlURL string) string {
	t.Helper()

	return settleSDLFrom(t, graphqlURL, "")
}

// settledSDLAfterChange is settledSDL for the post-op dump: it additionally waits
// until the SDL differs from the pre-op `before` snapshot before accepting
// stability. Because the connector rebuild is asynchronous, a plain settle can
// lock onto the stale pre-op SDL within the first poll window, yielding an empty
// per-engine delta that spuriously fails Layer C against Hasura's non-empty
// delta. The atomic state swap means a dump never observes a partial surface, so
// the first dump that differs from `before` is already the rebuilt one; the
// consecutive-identical check on top of that is belt-and-braces. If the deadline
// elapses without a change, the last dump is returned so the caller still gets a
// (then-failing, never silently-passing) comparison.
func settledSDLAfterChange(t *testing.T, graphqlURL, before string) string {
	t.Helper()

	return settleSDLFrom(t, graphqlURL, before)
}

// settleSDLFrom polls dumpSDL until two consecutive dumps are byte-identical and
// (when differentFrom is non-empty) differ from it, or the 30s deadline elapses.
// A dumped SDL is never the empty string, so differentFrom=="" reduces to a
// plain self-stability settle.
func settleSDLFrom(t *testing.T, graphqlURL, differentFrom string) string {
	t.Helper()

	deadline := time.Now().Add(30 * time.Second)
	prev := dumpSDL(t, graphqlURL)

	for time.Now().Before(deadline) {
		time.Sleep(500 * time.Millisecond)

		cur := dumpSDL(t, graphqlURL)
		if cur == prev && cur != differentFrom {
			return cur
		}

		prev = cur
	}

	return prev
}

// schemaDiff returns the cli's normalized diff between two SDL strings.
func schemaDiff(t *testing.T, before, after string) string {
	t.Helper()

	cli := buildParityCLI(t)
	dir := t.TempDir()
	bf, af := dir+"/before.graphqls", dir+"/after.graphqls"

	if err := os.WriteFile(bf, []byte(before), 0o600); err != nil {
		t.Fatalf("writing before SDL: %v", err)
	}

	if err := os.WriteFile(af, []byte(after), 0o600); err != nil {
		t.Fatalf("writing after SDL: %v", err)
	}

	cmd := exec.CommandContext(t.Context(), cli, "schema", "diff", "-a", bf, "-b", af)

	out, err := cmd.CombinedOutput()
	if err != nil {
		// `schema diff` exits 0 on both "identical" and "there is a diff"; it
		// exits non-zero ONLY when a schema fails to load/parse. So a non-zero
		// exit is a hard failure, not a delta — returning the error text as the
		// delta would let two identically-broken dumps false-pass Layer C.
		t.Fatalf("schema diff: %v: %s", err, out)
	}

	return string(out)
}

// compareSchemaDelta asserts that the SDL change the op produced is the same on
// both engines. It dumps each engine's SDL before (right after the case reset)
// and after the op, then compares each engine's own delta — so the pre-existing
// baseline divergences captured in schema.*.diff never cause a false failure.
//
// The op has already been applied to both engines by the caller; this re-derives
// "before" by resetting to baseline, dumping, then re-applying the op.
func compareSchemaDelta(t *testing.T, baseline jsontext.Value, tc metadataParityCase) {
	t.Helper()

	// The measured op has already been applied to both engines by the caller.
	// Re-derive each engine's "before" SDL by resetting to baseline and replaying
	// setup (but NOT the measured op); then re-apply the op so the engines end in
	// the post-op state we measure. Capturing "before" first lets the post-op
	// dump below wait until the surface actually reflects the op.
	resetMetadata(t, hasuraMetadataURL, baseline)
	resetMetadata(t, constellationMetadataURL, baseline)

	for _, s := range tc.setup {
		applyOpToBoth(t, "schema-delta setup", s)
	}

	hBefore := dumpSDL(t, hasuraURL)
	cBefore := settledSDL(t, constellationParityGraphQLURL)

	applyOpToBoth(t, "schema-delta op", tc.op)

	hAfter := dumpSDL(t, hasuraURL)
	// Wait for Constellation's asynchronous rebuild to swap in the post-op
	// surface (cAfter must differ from cBefore) before settling, so a slow
	// rebuild cannot leave cAfter on the stale pre-op SDL and fabricate an empty
	// delta. The Hasura side is synchronous, so a single dump suffices.
	cAfter := settledSDLAfterChange(t, constellationParityGraphQLURL, cBefore)

	hDelta := schemaDiff(t, hBefore, hAfter)
	cDelta := schemaDiff(t, cBefore, cAfter)

	if diff := cmp.Diff(hDelta, cDelta); diff != "" {
		t.Errorf("schema delta differs (-hasura +constellation):\n%s", diff)
	}
}
