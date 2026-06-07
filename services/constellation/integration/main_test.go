package integration_test

import (
	"bytes"
	"context"
	json "encoding/json/v2"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/jackc/pgx/v5"
)

const (
	// Default connection string for local Nhost development.
	defaultDBURL = "postgresql://postgres:postgres@localhost:5432/local"
)

// ReinitializeTestData cleans all seeded tables and re-applies the seed data
// from integration/nhost/seeds/default directory.
// This should be called before mutation tests to ensure a clean, stable state.
//
// Usage example:
//
//	func TestMutations(t *testing.T) {
//		ReinitializeTestData(t)
//		// Run your mutation tests here
//	}
//
// You can also call this at the start of a test suite or in a setup function
// that runs before each test to ensure consistent state.
func ReinitializeTestData(t *testing.T) {
	t.Helper()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultDBURL
	}

	conn, err := pgx.Connect(t.Context(), dbURL)
	if err != nil {
		t.Fatalf("failed to connect to database: %v", err)
	}
	defer conn.Close(t.Context())

	// Clean all tables in reverse dependency order
	if err := cleanTables(t.Context(), conn); err != nil {
		t.Fatalf("failed to clean tables: %v", err)
	}

	// Re-apply seeds
	if err := applySeedFiles(t.Context(), conn); err != nil {
		t.Fatalf("failed to apply seeds: %v", err)
	}
}

// cleanTables truncates all tables that are populated by seed files
// Tables are listed in reverse dependency order to avoid foreign key conflicts.
func cleanTables(ctx context.Context, conn *pgx.Conn) error {
	tables := []string{
		"note_replies",
		"notes",
		"exercise_log_sets",
		"exercise_logs",
		"identity.artists",
		"identity_check_logs",
		"department_files",
		"kb_entry_departments",
		"user_departments",
		"storage.files",
		"kb_entries",
		"news",
		"auth.users",
		"department_roles",
		"departments",
		"user_profiles",
	}

	for _, table := range tables {
		_, err := conn.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
		if err != nil {
			return fmt.Errorf("failed to truncate table %s: %w", table, err)
		}
	}

	return nil
}

// applySeedFiles reads and executes all SQL files from integration/nhost/seeds/default
// in alphabetical order (which corresponds to their numbered sequence).
func applySeedFiles(ctx context.Context, conn *pgx.Conn) error {
	seedsDir := "nhost/seeds/default"

	entries, err := os.ReadDir(seedsDir)
	if err != nil {
		return fmt.Errorf("failed to read seeds directory: %w", err)
	}

	// Filter only .sql files and sort them
	var sqlFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".sql" {
			sqlFiles = append(sqlFiles, entry.Name())
		}
	}

	sort.Strings(sqlFiles)

	// Execute each seed file
	for _, filename := range sqlFiles {
		filepath := filepath.Join(seedsDir, filename)

		content, err := os.ReadFile(filepath)
		if err != nil {
			return fmt.Errorf("failed to read seed file %s: %w", filename, err)
		}

		_, err = conn.Exec(ctx, string(content))
		if err != nil {
			return fmt.Errorf("failed to execute seed file %s: %w", filename, err)
		}
	}

	return nil
}

type query struct {
	Query            string         `json:"query"`
	OperationName    string         `json:"operationName,omitempty"`
	Variables        map[string]any `json:"variables,omitempty"`
	Role             string
	SessionVariables map[string]string
}

type responseNormalizer func(any) any

// TestCase represents a single test case for GraphQL queries/mutations.
type TestCase struct {
	name                     string
	query                    query
	expected                 any
	assertConstellationState func(t *testing.T, headers http.Header)
	responseNormalizer       responseNormalizer
}

func runConstellationStateAssertion(t *testing.T, tc TestCase, headers http.Header) {
	t.Helper()

	if tc.assertConstellationState != nil {
		tc.assertConstellationState(t, headers)
	}
}

func normalizeResponse(value any, normalizer responseNormalizer) any {
	if normalizer == nil {
		return value
	}

	return normalizer(value)
}

func redactActionVolatiles(value any) any {
	return redactResponseValue(value, nil, func(path []string, candidate any) (any, bool) {
		if len(path) == 0 {
			return nil, false
		}

		key := strings.ToLower(path[len(path)-1])
		if isVolatileHeaderKey(key) {
			return "<redacted>", true
		}

		s, ok := candidate.(string)
		if !ok {
			return nil, false
		}

		switch {
		case isUUIDLike(s):
			return "<uuid>", true
		case isTimestampLike(s):
			return "<timestamp>", true
		default:
			return nil, false
		}
	})
}

type responseRedactor func(path []string, value any) (any, bool)

func redactResponseValue(value any, path []string, redactor responseRedactor) any {
	if replacement, ok := redactor(path, value); ok {
		return replacement
	}

	switch typed := value.(type) {
	case map[string]any:
		redacted := make(map[string]any, len(typed))
		for k, v := range typed {
			childPath := make([]string, len(path)+1)
			copy(childPath, path)
			childPath[len(path)] = k

			redacted[k] = redactResponseValue(v, childPath, redactor)
		}

		return redacted
	case []any:
		redacted := make([]any, len(typed))
		for i, v := range typed {
			redacted[i] = redactResponseValue(v, path, redactor)
		}

		return redacted
	default:
		return value
	}
}

func isVolatileHeaderKey(key string) bool {
	switch key {
	case "date", "request-id", "x-amzn-trace-id", "x-request-id", "x-varnish":
		return true
	default:
		return false
	}
}

func isUUIDLike(s string) bool {
	if len(s) != 36 {
		return false
	}

	for i, r := range s {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !isLowerHex(r) && !isUpperHex(r) {
				return false
			}
		}
	}

	return true
}

func isLowerHex(r rune) bool {
	return r >= '0' && r <= '9' || r >= 'a' && r <= 'f'
}

func isUpperHex(r rune) bool {
	return r >= 'A' && r <= 'F'
}

func isTimestampLike(s string) bool {
	_, err := time.Parse(time.RFC3339Nano, s)

	return err == nil
}

// TestConfig configures how the test runner should execute tests.
type TestConfig struct {
	// IsMutation indicates whether the test cases mutate data.
	// If true, test data will be reinitialized before each test case.
	// If false, test data is initialized once before all test cases.
	IsMutation bool

	// ReinitBetweenQueries indicates whether to reinitialize data between
	// Hasura and Constellation queries within the same test case.
	// This is typically true for mutations that change state (update, delete)
	// and false for mutations that only add data (insert).
	ReinitBetweenQueries bool
}

func makeHTTPQuery(
	ctx context.Context,
	url string,
	query query,
	headers http.Header,
) (any, error) {
	cl := http.Client{}

	b, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	for k, v := range headers {
		for _, vv := range v {
			req.Header.Add(k, vv)
		}
	}

	resp, err := cl.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %w", err)
	}
	defer resp.Body.Close()

	var result any
	if err := json.UnmarshalRead(resp.Body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

// RunGraphQLTests executes a suite of GraphQL test cases against both
// Hasura and Constellation, comparing their responses.
//
// Example usage for queries:
//
//	RunGraphQLTests(t, cases, TestConfig{
//		IsMutation: false,
//	})
//
// Example usage for insert mutations:
//
//	RunGraphQLTests(t, cases, TestConfig{
//		IsMutation: true,
//		ReinitBetweenQueries: false,
//	})
//
// Example usage for update/delete mutations:
//
//	RunGraphQLTests(t, cases, TestConfig{
//		IsMutation: true,
//		ReinitBetweenQueries: true,
//	})
func RunGraphQLTests(t *testing.T, cases []TestCase, config TestConfig) {
	t.Helper()

	// Atomic because non-mutation subtests run via t.Parallel below.
	var faster atomic.Int64

	// Log performance summary after all subtests complete
	t.Cleanup(func() {
		f := faster.Load()
		t.Logf(
			"🏎️🏎️🏎️ Summary: Constellation was faster in %.2f%% of the tests (%d/%d)",
			float64(f)/float64(len(cases))*100,
			f,
			len(cases),
		)
	})

	// For non-mutating tests (queries), initialize once before the loop
	if !config.IsMutation {
		ReinitializeTestData(t)
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// For mutating tests, initialize before each test case
			if config.IsMutation {
				ReinitializeTestData(t)
			} else {
				t.Parallel()
			}

			headers := http.Header{
				"x-hasura-admin-secret": []string{adminSecret},
				"x-hasura-role":         []string{tc.query.Role},
			}

			for k, v := range tc.query.SessionVariables {
				headerKey := "x-hasura-" + k
				headers.Set(headerKey, v)
			}

			// Measure and execute Hasura query
			ths := time.Now()

			hasuraResp := tc.expected

			var err error
			if tc.expected == nil {
				hasuraResp, err = makeHTTPQuery(
					t.Context(),
					hasuraURL,
					tc.query,
					headers,
				)
				if err != nil {
					t.Fatalf("hasura query failed: %v", err)
				}
			}

			the := time.Since(ths)

			// For mutations that change state, reinitialize between queries
			// to ensure both systems start from the same state
			if config.ReinitBetweenQueries {
				ReinitializeTestData(t)
			}

			// Measure and execute Constellation query
			tcs := time.Now()

			constellationResp, err := makeHTTPQuery(
				t.Context(),
				constellationURL,
				tc.query,
				headers,
			)
			if err != nil {
				t.Fatalf("constellation query failed: %v", err)
			}

			tce := time.Since(tcs)

			// Track performance comparison
			delta := tce - the
			if delta < 0 {
				faster.Add(1)
				t.Logf("🏎️ Constellation was faster by %s for test case: %s", -delta, tc.name)
			} else {
				t.Logf("🐌 Constellation was slower by %s for test case: %s", delta, tc.name)
			}

			// Compare responses
			hasuraComparable := normalizeResponse(hasuraResp, tc.responseNormalizer)

			constellationComparable := normalizeResponse(constellationResp, tc.responseNormalizer)
			if diff := cmp.Diff(hasuraComparable, constellationComparable); diff != "" {
				t.Errorf("responses differ (-hasura +constellation):\n%s", diff)
			}

			runConstellationStateAssertion(t, tc, headers)
		})
	}
}
