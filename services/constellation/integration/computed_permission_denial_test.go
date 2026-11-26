package integration_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

// TestComputedPermissionDenial compares live rollback and persisted rows, not
// recorded expected responses. The engines share one database, so each run
// begins from the same fixture state. It must remain serial.
//
//nolint:paralleltest,gocognit,nestif,cyclop // Both live endpoints share one fixture; denial/error/rollback assertions must stay serialized.
func TestComputedPermissionDenial(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultDBURL
	}

	conn, err := pgx.Connect(t.Context(), dbURL)
	if err != nil {
		t.Fatalf("fixture DB: %v", err)
	}
	defer conn.Close(t.Context())

	reset := func(ctx context.Context) {
		if _, err := conn.Exec(
			ctx,
			`DELETE FROM cf_predicates.rules WHERE id IN (901,902)`,
		); err != nil {
			t.Fatalf("reset permission fixture: %v", err)
		}
	}

	defer func() {
		if _, err := conn.Exec(
			context.Background(),
			`DELETE FROM cf_predicates.rules WHERE id IN (901,902)`,
		); err != nil {
			t.Errorf("permission fixture cleanup: %v", err)
		}
	}()

	headers := http.Header{}
	headers.Set("x-hasura-admin-secret", adminSecret)
	headers.Set("x-hasura-role", "cf_predicate_guard")

	for _, tc := range []struct {
		name, mutation string
		accepted       bool
	}{
		{"denied batch rollback", `mutation { insert_cf_predicates_rules(objects:[{id:901,owner_id:2,label:"denied"},{id:902,owner_id:1,label:"allowed"}]) { affected_rows } }`, false},
		{"accepted", `mutation { insert_cf_predicates_rules(objects:[{id:902,owner_id:1,label:"allowed"}]) { affected_rows } }`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var baseline []string
			for i, endpoint := range []string{hasuraURL, constellationURL} {
				reset(t.Context())

				result, err := makeHTTPQuery(
					t.Context(),
					endpoint,
					query{Query: tc.mutation, Role: "cf_predicate_guard"},
					headers,
				)
				if err != nil {
					t.Fatalf("%s mutation: %v", endpoint, err)
				}

				response, ok := result.(map[string]any)
				if !ok {
					t.Fatalf("%s response shape: %v", endpoint, result)
				}

				if tc.accepted {
					data, ok := response["data"].(map[string]any)
					if !ok ||
						!reflect.DeepEqual(
							data["insert_cf_predicates_rules"],
							map[string]any{"affected_rows": float64(1)},
						) {
						t.Fatalf("%s expected accepted mutation: %v", endpoint, result)
					}
				} else {
					errs, ok := response["errors"].([]any)
					if !ok || len(errs) == 0 {
						t.Fatalf("%s failed-open: %v", endpoint, result)
					}

					if i == 0 {
						first, ok := errs[0].(map[string]any)
						if !ok {
							t.Fatalf("Hasura error shape: %v", result)
						}

						ext, ok := first["extensions"].(map[string]any)
						if !ok || ext["code"] != "permission-error" {
							t.Fatalf("Hasura permission denial: %v", result)
						}
					} else if !strings.Contains(fmt.Sprint(errs), "ZZ901") || !strings.Contains(fmt.Sprint(errs), "insert_cf_predicates_rules") {
						t.Fatalf("Constellation root permission denial: %v", result)
					}
				}

				rows, err := conn.Query(
					t.Context(),
					`SELECT id::text || ':' || label FROM cf_predicates.rules WHERE id IN (901,902) ORDER BY id`,
				)
				if err != nil {
					t.Fatal(err)
				}

				got := []string{}
				for rows.Next() {
					var label string
					if err := rows.Scan(&label); err != nil {
						rows.Close()
						t.Fatal(err)
					}

					got = append(got, label)
				}

				if err := rows.Err(); err != nil {
					rows.Close()
					t.Fatal(err)
				}

				rows.Close()

				want := []string{}
				if tc.accepted {
					want = []string{"902:allowed"}
				}

				if !reflect.DeepEqual(got, want) {
					t.Fatalf("%s persisted rows %v, want %v", endpoint, got, want)
				}

				if i == 0 {
					baseline = got
				} else if !reflect.DeepEqual(got, baseline) {
					t.Fatalf("stored rows differ: Hasura=%v Constellation=%v", baseline, got)
				}
			}
		})
	}
}
