package queries_test

import (
	"os"
	"testing"
)

func TestComputedScalarSQLGolden(t *testing.T) {
	t.Parallel()
	//nolint:dogsled // The fixture also returns the pool, objects, metadata and grouped ops.
	roots, _, _, _, _ := computedTestFixture(
		t,
	)
	op := computedOperation(
		t,
		roots,
		`query { cf_select_items(where:{id:{_eq:1}}) { item_label item_score(args:{multiplier:2}) item_second(args:{multiplier:2}) item_payload(path:"status") } }`,
		nil,
	)

	path := "testdata/computed_scalar_query.sql"
	if *updateGolden {
		if err := os.WriteFile(path, []byte(op.SQL+"\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	golden, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	if op.SQL+"\n" != string(golden) {
		t.Fatalf("computed SQL differs from %s\ngot: %s", path, op.SQL)
	}
}
